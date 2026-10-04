import { HttpStatus, Logger } from '@nestjs/common';
import { ClientSession, Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { isDatabaseUnavailableError } from '../../common/utils/mongo-error.util';
import { UserDocument } from '../../user/schemas/user.schema';
import { asAuthorityUnavailable } from '../../session/utils/authority-unavailable';
import { AdminUserAccessService } from '../services/admin-user-access.service';

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
 * cannot be acted on.
 */
export async function loadAuthorizedUser(
  userModel: Model<UserDocument>,
  accessService: AdminUserAccessService,
  session: ClientSession,
  targetId: string,
  actorId: string,
  message?: string,
): Promise<UserDocument> {
  const current = await userModel.findById(targetId).session(session).exec();
  if (!current || current.isDeleted) {
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
  );
  return current;
}
