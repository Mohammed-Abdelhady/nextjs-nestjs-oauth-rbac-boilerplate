import { ClientSession, Connection, Model, Types } from 'mongoose';
import { HttpStatus, Logger } from '@nestjs/common';
import { RoleDocument } from '../../schemas/role.schema';
import { UserDocument } from '../../../user/schemas/user.schema';
import { UserRole } from '../../../user/enums/user-role.enum';
import { SecurityEventService } from '../../../session/services/security-event.service';
import { SECURITY_EVENT_ACTION } from '../../../session/constants/security-event-action';
import { REVOKED_REASON } from '../../../session/constants/revoked-reason';
import { withMajorityTransaction } from '../../../session/utils/transactions/mongo-transaction';
import {
  ROLE_HOLDER_SWEEP_PASSES,
  ROLE_SWEEP_SLUG_REUSED,
} from '../../../common/constants/roles';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';

interface HolderModels {
  userModel: Model<UserDocument>;
  events: SecurityEventService;
}

export async function moveRoleHolders(
  input: HolderModels & {
    previousSlugs: string[];
    nextSlug: string;
    actorId: string;
    session: ClientSession;
    holderIds?: Types.ObjectId[];
  },
): Promise<number> {
  const { userModel, events, previousSlugs, nextSlug, actorId, session } =
    input;
  const filter = {
    role: { $in: previousSlugs },
    ...(input.holderIds ? { _id: { $in: input.holderIds } } : {}),
  };
  const holders = await userModel
    .find(filter)
    .select('_id')
    .session(session)
    .lean<{ _id: Types.ObjectId }[]>()
    .exec();
  if (holders.length === 0) return 0;
  const affected = await userModel
    .updateMany(
      filter,
      {
        $set: {
          role: nextSlug,
        },
        $inc: { sessionVersion: 1 },
      },
      { session },
    )
    .exec();
  await events.recordMany(
    holders.map((holder) => ({
      targetUserId: holder._id.toString(),
      actorId,
      action: SECURITY_EVENT_ACTION.SESSIONS_REVOKED_ALL,
      reasonCode: REVOKED_REASON.ADMIN_FORCED,
    })),
    session,
  );
  return affected.modifiedCount;
}

export async function sweepRoleHolders(
  input: HolderModels & {
    connection: Connection;
    roleModel: Model<RoleDocument>;
    roleId: Types.ObjectId;
    previousSlug: string;
    actorId: string;
    logger: Logger;
    fenceDestination?: boolean;
    onMoved?: (count: number) => void;
    userId?: Types.ObjectId;
    previousRoleId?: Types.ObjectId;
  },
): Promise<number> {
  const {
    connection,
    roleModel,
    userModel,
    events,
    roleId,
    previousSlug,
    actorId,
  } = input;
  let moved = 0;
  const sources = new Set([previousSlug]);
  // Assignment reconciliation and this sweep cover both commit orders.
  // A crash between assignment commit and reconciliation can still leave a stale slug.
  for (let pass = 0; pass < ROLE_HOLDER_SWEEP_PASSES; pass += 1) {
    const outcome = await withMajorityTransaction(
      connection,
      async (session) => {
        const liveRole = await roleModel
          .findById(roleId)
          .session(session)
          .exec();
        const reused = await roleModel
          .findOne({ slug: previousSlug })
          .session(session)
          .exec();
        if (reused && !reused._id.equals(roleId)) {
          return { count: 0, destinations: [], reused: true };
        }
        const liveSources = await roleModel
          .find({ slug: { $in: [...sources] } })
          .select('slug')
          .session(session)
          .lean()
          .exec();
        const stale = await userModel
          .find({
            role: {
              $in: [...sources],
              $nin: liveSources.map((role) => role.slug),
            },
          })
          .select('_id role')
          .session(session)
          .lean()
          .exec();
        if (stale.length === 0)
          return { count: 0, destinations: [], reused: false };
        const fallback =
          liveRole ??
          (await roleModel
            .findOne({ slug: UserRole.USER })
            .session(session)
            .exec());
        const groups = new Map<
          string,
          { role: RoleDocument; ids: Types.ObjectId[] }
        >();
        const restorePreviousRoles = !liveRole;
        const deletion = !liveRole
          ? await events.roleDeletionSweep(roleId, session)
          : undefined;
        const pendingOwner =
          !liveRole && !deletion
            ? await roleModel
                .findOne({
                  pendingHolderSweeps: { $elemMatch: { roleId, previousSlug } },
                })
                .session(session)
                .exec()
            : undefined;
        const restoreActor =
          deletion?.actorId ??
          pendingOwner?.pendingHolderSweeps.find(
            (ref) =>
              ref.roleId.equals(roleId) && ref.previousSlug === previousSlug,
          )?.actorId ??
          actorId;
        const previous = restorePreviousRoles
          ? await events.previousRoleIdsForAssignment(
              stale.map((holder) => holder._id),
              roleId,
              session,
            )
          : new Map<string, Types.ObjectId>();
        const restoredRoles = new Map<string, RoleDocument | null>();
        for (const holder of stale) {
          const restoreId =
            previous.get(holder._id.toString()) ??
            (holder._id.equals(input.userId)
              ? input.previousRoleId
              : undefined);
          let destination: RoleDocument | null = fallback;
          if (restorePreviousRoles && restoreId) {
            const key = restoreId.toString();
            if (!restoredRoles.has(key)) {
              restoredRoles.set(
                key,
                await roleModel.findById(restoreId).session(session).exec(),
              );
            }
            destination = restoredRoles.get(key) ?? fallback;
          }
          if (!destination)
            throw new AppException(
              ErrorCode.ROLE_NOT_FOUND,
              'Default role does not exist',
              HttpStatus.NOT_FOUND,
            );
          const group = groups.get(destination.slug) ?? {
            role: destination,
            ids: [],
          };
          group.ids.push(holder._id);
          groups.set(destination.slug, group);
        }
        let count = 0;
        for (const group of groups.values()) {
          // Only the role-edit sweep fences its destination. Assignment repair
          // never writes a role document, so concurrent callers share one bulk move.
          if (input.fenceDestination) {
            await roleModel
              .updateOne(
                { _id: group.role._id },
                { $inc: { __v: 1 } },
                { session, timestamps: false },
              )
              .exec();
          }
          count += await moveRoleHolders({
            userModel,
            events,
            previousSlugs: stale.map((holder) => holder.role),
            holderIds: group.ids,
            nextSlug: group.role.slug,
            actorId: restoreActor,
            session,
          });
        }
        return { count, destinations: [...groups.keys()], reused: false };
      },
    );
    moved += outcome.count;
    input.onMoved?.(outcome.count);
    for (const slug of outcome.destinations) sources.add(slug);
    if (outcome.reused) {
      input.logger.warn({
        event: ROLE_SWEEP_SLUG_REUSED,
        roleId: roleId.toString(),
        previousSlug,
        actorId,
      });
    }
    if (outcome.count === 0) return moved;
  }
  const live = await roleModel
    .find({ slug: { $in: [...sources] } })
    .select('slug')
    .lean()
    .exec();
  const remaining = await userModel
    .find({
      role: { $in: [...sources], $nin: live.map((role) => role.slug) },
    })
    .select('_id role')
    .lean()
    .exec();
  if (remaining.length === 0) return moved;
  throw new AppException(
    ErrorCode.AUTHORITY_UNAVAILABLE,
    'Role holder reconciliation did not finish',
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}
