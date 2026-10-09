import { Logger } from '@nestjs/common';
import { Connection, Model, Types } from 'mongoose';
import { PendingRoleSweep, RoleDocument } from '../../schemas/role.schema';
import { UserDocument } from '../../../user/schemas/user.schema';
import { SecurityEventService } from '../../../session/services/security-event.service';
import {
  ROLE_PENDING_SWEEP_LIMIT,
  ROLE_SWEEP_PENDING,
} from '../../../common/constants/roles';
import { sweepRoleHolders } from './role-holder.util';
import { describeDriverError } from '../../../common/utils/mongo-error.util';

export async function repairPendingRoleSweeps(input: {
  connection: Connection;
  roleModel: Model<RoleDocument>;
  userModel: Model<UserDocument>;
  events: SecurityEventService;
  ownerId: Types.ObjectId;
  refs: PendingRoleSweep[];
  logger: Logger;
  recorded?: boolean;
  shouldStop?: () => boolean;
}): Promise<number> {
  let moved = 0;
  for (const ref of input.refs) {
    if (input.shouldStop?.()) break;
    try {
      await sweepRoleHolders({
        ...input,
        roleId: ref.roleId,
        previousSlug: ref.previousSlug,
        actorId: ref.actorId,
        fenceDestination: true,
        onMoved: (count) => {
          moved += count;
        },
      });
      if (input.recorded !== false)
        await input.roleModel
          .updateOne(
            { _id: input.ownerId },
            {
              $pull: {
                pendingHolderSweeps: {
                  roleId: ref.roleId,
                  previousSlug: ref.previousSlug,
                  actorId: ref.actorId,
                  sweepId: ref.sweepId ?? { $exists: false },
                },
              },
            },
          )
          .exec();
      await input.events.completeRoleDeletionSweep(ref.roleId);
    } catch (error) {
      let pendingRecordError: unknown;
      if (input.recorded === false) {
        try {
          await input.roleModel
            .updateOne(
              {
                _id: input.ownerId,
                pendingHolderSweeps: {
                  $not: {
                    $elemMatch: {
                      roleId: ref.roleId,
                      previousSlug: ref.previousSlug,
                    },
                  },
                },
                $expr: {
                  $lt: [
                    { $size: { $ifNull: ['$pendingHolderSweeps', []] } },
                    ROLE_PENDING_SWEEP_LIMIT,
                  ],
                },
              },
              { $push: { pendingHolderSweeps: ref } },
            )
            .exec();
        } catch (recordError) {
          pendingRecordError = recordError;
        }
      }
      // The role operation already committed. Its durable repair remains pending.
      input.logger.error({
        event: ROLE_SWEEP_PENDING,
        roleId: ref.roleId.toString(),
        previousSlug: ref.previousSlug,
        actorId: ref.actorId,
        error: describeDriverError(error),
        ...(pendingRecordError
          ? { pendingRecordError: describeDriverError(pendingRecordError) }
          : {}),
      });
    }
  }
  return moved;
}
