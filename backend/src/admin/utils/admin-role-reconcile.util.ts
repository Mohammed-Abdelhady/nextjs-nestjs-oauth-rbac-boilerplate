import { HttpStatus, Logger } from '@nestjs/common';
import { Connection, Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { RoleDocument } from '../../role/schemas/role.schema';
import { UserDocument } from '../../user/schemas/user.schema';
import { SecurityEventService } from '../../session/services/security-event.service';
import { withMajorityTransaction } from '../../session/utils/mongo-transaction';
import { sweepRoleHolders } from '../../role/utils/role-holder.util';
import { AssignedRoleRef } from '../types/assigned-role-ref';
import { ADMIN_ROLE_RECONCILE_FAILED } from '../constants/admin-user.constants';
import { describeDriverError } from '../../common/utils/mongo-error.util';

/** Resolve the assigned role by id after commit and repair or undo the assignment. */
export async function reconcileAssignedRole(input: {
  connection: Connection;
  roleModel: Model<RoleDocument>;
  userModel: Model<UserDocument>;
  events: SecurityEventService;
  logger: Logger;
  actorId: string;
  userId: Types.ObjectId;
  ref: AssignedRoleRef;
}): Promise<string> {
  const { connection, roleModel, userModel, logger, userId, ref } = input;
  let missing = false;
  let current: UserDocument | null;
  try {
    const role = await roleModel.findById(ref.roleId).exec();
    if (role) {
      if (role.slug !== ref.assignedSlug) {
        await sweepRoleHolders({
          ...input,
          roleId: ref.roleId,
          previousSlug: ref.assignedSlug,
        });
      }
    } else if (ref.created) {
      current = await withMajorityTransaction(connection, async (session) => {
        await userModel
          .deleteOne(
            {
              _id: userId,
              role: ref.assignedSlug,
              updatedAt: ref.created?.updatedAt,
              sessionVersion: ref.created?.sessionVersion,
            },
            { session },
          )
          .exec();
        return userModel.findById(userId).session(session).exec();
      });
      missing = !current;
      if (
        current &&
        !(await roleModel.findOne({ slug: current.role }).exec())
      ) {
        await sweepRoleHolders({
          ...input,
          roleId: ref.roleId,
          previousSlug: current.role,
        });
      }
    } else {
      await sweepRoleHolders({
        ...input,
        roleId: ref.roleId,
        previousSlug: ref.assignedSlug,
        previousRoleId: ref.previousRoleId,
      });
      missing = true;
    }
    current = await userModel.findById(userId).exec();
    if (!ref.created && role && current && current.role !== role.slug) {
      missing = !(await roleModel.findById(ref.roleId).exec());
    }
  } catch (error) {
    logger.error({
      event: ADMIN_ROLE_RECONCILE_FAILED,
      userId: userId.toString(),
      roleId: ref.roleId.toString(),
      error: describeDriverError(error),
    });
    throw error;
  }
  if (missing || !current) {
    throw new AppException(
      ErrorCode.ROLE_NOT_FOUND,
      `Role "${ref.assignedSlug}" does not exist`,
      HttpStatus.NOT_FOUND,
    );
  }
  return current.role;
}
