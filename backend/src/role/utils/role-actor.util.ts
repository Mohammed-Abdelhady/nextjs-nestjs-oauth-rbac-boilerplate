import { HttpStatus } from '@nestjs/common';
import { ClientSession, Model } from 'mongoose';
import { UserDocument } from '../../user/schemas/user.schema';
import { RoleDocument } from '../schemas/role.schema';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { hasPermission } from '../../common/utils/permission.utils';

export async function assertFreshRolePermission(
  userModel: Model<UserDocument>,
  roleModel: Model<RoleDocument>,
  actorId: string,
  permission: string,
  session: ClientSession,
): Promise<void> {
  const actor = await userModel.findById(actorId).session(session).exec();
  if (!actor || actor.isDeleted) {
    throw new AppException(
      ErrorCode.SESSION_INVALID,
      'Actor is no longer active',
      HttpStatus.UNAUTHORIZED,
    );
  }
  const role = await roleModel
    .findOne({ slug: actor.role })
    .session(session)
    .exec();
  if (
    !hasPermission(
      [...(role?.permissions ?? []), ...actor.permissions],
      permission,
    )
  ) {
    throw new AppException(
      ErrorCode.CANNOT_MODIFY_HIGHER_ROLE,
      'Actor can no longer manage roles',
      HttpStatus.FORBIDDEN,
    );
  }
}
