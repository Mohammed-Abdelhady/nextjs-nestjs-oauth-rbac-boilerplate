import { Logger } from '@nestjs/common';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { mongoUnitOfWork } from '../../../session/persistence/mongo/mongo-unit-of-work';
import { SecurityEventService } from '../../../session/services/security-event.service';
import { UserDocument } from '../../../user/schemas/user.schema';
import { MongoRoleChangeStore } from '../../persistence/mongo/mongo-role-change.store';
import { MongoRoleHolders } from '../../persistence/mongo/mongo-role-holders';
import { MongoRoleSweepStore } from '../../persistence/mongo/mongo-role-sweep.store';
import { MongoDriverErrorRunner } from '../../persistence/mongo/mongo-role-stores';
import { RoleDocument } from '../../schemas/role.schema';
import {
  moveRoleHolders as moveHoldersInWork,
  sweepRoleHolders as sweepHolders,
} from '../../sweeps/role-holder-sweep';

interface HolderModels {
  userModel: Model<UserDocument>;
  events: SecurityEventService;
}

/**
 * The holder move for callers that still own a Mongoose transaction. It goes
 * away when those callers move behind a store.
 */
export function moveRoleHolders(
  input: HolderModels & {
    previousSlugs: string[];
    nextSlug: string;
    actorId: string;
    session: ClientSession;
    holderIds?: Types.ObjectId[];
  },
): Promise<number> {
  return moveHoldersInWork(
    new MongoRoleHolders(input.userModel, input.events),
    mongoUnitOfWork(input.session),
    {
      fromSlugs: input.previousSlugs,
      toSlug: input.nextSlug,
      actorId: input.actorId,
      ...(input.holderIds
        ? { holderIds: input.holderIds.map((id) => id.toString()) }
        : {}),
    },
  );
}

/**
 * The holder sweep for callers that still hold Mongoose models. Driver errors
 * reach them unchanged.
 */
export function sweepRoleHolders(
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
  const { connection, roleModel, userModel, events } = input;
  return sweepHolders(
    {
      runner: new MongoDriverErrorRunner(connection),
      changes: new MongoRoleChangeStore(roleModel, userModel, events),
      sweeps: new MongoRoleSweepStore(roleModel, userModel, events),
    },
    {
      roleId: input.roleId.toString(),
      previousSlug: input.previousSlug,
      actorId: input.actorId,
      logger: input.logger,
      fenceDestination: input.fenceDestination,
      onMoved: input.onMoved,
      userId: input.userId?.toString(),
      previousRoleId: input.previousRoleId?.toString(),
    },
  );
}
