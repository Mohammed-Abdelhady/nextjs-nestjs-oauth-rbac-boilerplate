import { HttpStatus, Logger } from '@nestjs/common';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { isDatabaseUnavailableError } from '../../common/utils/mongo-error.util';
import { UserDocument } from '../../user/schemas/user.schema';
import { asAuthorityUnavailable } from '../../session/utils/authority/authority-unavailable';
import { AdminUserAccessService } from '../services/users/admin-user-access.service';
import { withMajorityTransaction } from '../../session/utils/transactions/mongo-transaction';

/**
 * Only a genuine database error is an authority failure; a domain refusal
 * (AppException), a validation error or a programming error keeps its own
 * answer. Shares the classification with the role edit path.
 */
export function rethrowOrUnavailable(error: unknown): never {
  if (!isDatabaseUnavailableError(error)) {
    throw error;
  }
  asAuthorityUnavailable(error);
}

/**
 * Write the same session-revocation line the SessionService writes when it
 * owns the transaction, now that an in-transaction caller logs after commit.
 */
export function logSessionRevocation(
  logger: Logger,
  userId: Types.ObjectId,
  count: number,
): void {
  logger.log(
    `All sessions invalidated for user ${userId.toString()}: ${count} document(s)`,
  );
}

/**
 * Re-read the target and the acting account inside the caller's transaction
 * and repeat the write check against the roles they hold now, so a promotion
 * of the target or a demotion of the actor that lands after the pre-check
 * cannot be acted on. A deactivated target is reported as missing unless the
 * caller is the one bringing it back.
 */
export async function loadAuthorizedUser(
  userModel: Model<UserDocument>,
  accessService: AdminUserAccessService,
  session: ClientSession,
  targetId: string,
  actorId: string,
  message?: string,
  options: { includeDeleted?: boolean; requireAdmin?: boolean } = {},
): Promise<UserDocument> {
  const current = await userModel.findById(targetId).session(session).exec();
  if (!current || (current.isDeleted && !options.includeDeleted)) {
    throw new AppException(
      ErrorCode.USER_NOT_FOUND,
      'User not found',
      HttpStatus.NOT_FOUND,
    );
  }
  await accessService.assertFreshActorCanModify(
    actorId,
    current.role,
    session,
    message,
    options.requireAdmin,
  );
  return current;
}

/**
 * Write an admin name or address edit onto the target as it is now, after the
 * actor's rank is checked again. The address fields come from the document
 * the email change service prepared, and mailed a code for, beforehand.
 */
export function saveUserUpdate(
  connection: Connection,
  userModel: Model<UserDocument>,
  accessService: AdminUserAccessService,
  edit: {
    id: string;
    actorId: string;
    name?: string;
    moved?: UserDocument;
    previousEmail: string;
    previousGeneration: number;
  },
): Promise<UserDocument> {
  return withMajorityTransaction(connection, async (session) => {
    const current = await loadAuthorizedUser(
      userModel,
      accessService,
      session,
      edit.id,
      edit.actorId,
      undefined,
      { requireAdmin: Boolean(edit.moved) },
    );
    if (edit.name !== undefined) {
      current.name = edit.name;
    }
    if (edit.moved) {
      if (
        current.email !== edit.previousEmail ||
        (current.addressGeneration ?? 0) !== edit.previousGeneration
      ) {
        throw new AppException(
          ErrorCode.CONFLICT,
          'The email address changed while this edit was prepared',
          HttpStatus.CONFLICT,
        );
      }
      current.email = edit.moved.email;
      current.addressGeneration = edit.moved.addressGeneration;
      current.isVerified = false;
    }
    await current.save({ session });
    return current;
  });
}
