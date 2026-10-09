import { HttpStatus } from '@nestjs/common';
import { Connection, Error as MongooseError, Model } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { ROLE_PERMISSIONS } from '../../common/constants/permissions';
import { CUSTOM_ROLE_LEVEL } from '../../common/utils/role-hierarchy';
import {
  isDatabaseUnavailableError,
  isMongoDuplicateKeyError,
} from '../../common/utils/mongo-error.util';
import { asAuthorityUnavailable } from '../../session/utils/authority/authority-unavailable';
import { withMajorityTransaction } from '../../session/utils/transactions/mongo-transaction';
import { UserDocument } from '../../user/schemas/user.schema';
import { CreateRoleDto } from '../dto/create-role.dto';
import { RoleDocument } from '../schemas/role.schema';
import { assertCanGrant, assertFreshRolePermission } from './role-actor.util';
import { dedupePermissions } from './role.util';

interface RoleStores {
  connection: Connection;
  userModel: Model<UserDocument>;
  roleModel: Model<RoleDocument>;
}

/**
 * Store a new custom role. The actor is read inside the transaction, so a
 * permission it lost after the request was admitted cannot be handed out.
 */
export function createRoleWithinCeiling(
  stores: RoleStores,
  dto: CreateRoleDto,
  slug: string,
  actorId: string,
): Promise<RoleDocument> {
  return withMajorityTransaction(stores.connection, async (session) => {
    const actor = await assertFreshRolePermission(
      stores.userModel,
      stores.roleModel,
      actorId,
      ROLE_PERMISSIONS.CREATE_ALL,
      session,
    );
    assertCanGrant(actor, dto.permissions);
    const role = new stores.roleModel({
      name: dto.name,
      slug,
      description: dto.description,
      isSystemRole: false,
      isProtected: false,
      level: CUSTOM_ROLE_LEVEL,
      permissions: dedupePermissions(dto.permissions),
    });
    return role.save({ session });
  });
}

/** Turn a failed role write into the answer the role routes give for it. */
export function rethrowRoleWriteError(
  error: unknown,
  requestedSlug?: string,
): never {
  if (isMongoDuplicateKeyError(error)) {
    throw new AppException(
      ErrorCode.ROLE_NAME_TAKEN,
      `Role with slug "${requestedSlug ?? 'requested'}" already exists`,
      HttpStatus.CONFLICT,
    );
  }
  if (error instanceof MongooseError.ValidationError) {
    throw new AppException(
      ErrorCode.VALIDATION_ERROR,
      error.message,
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!isDatabaseUnavailableError(error)) {
    throw error;
  }
  asAuthorityUnavailable(error);
}
