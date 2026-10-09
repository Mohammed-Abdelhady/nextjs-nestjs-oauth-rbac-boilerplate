import { Logger } from '@nestjs/common';
import { ClientSession, Model, Types } from 'mongoose';
import { Response } from 'express';
import { UserDocument } from '../../user/schemas/user.schema';
import { AuthProvider } from '../../user/enums/auth-provider.enum';
import { isMongoDuplicateKeyError } from '../../common/utils/mongo-error.util';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ActivateResponseDto } from '../dto/activate-response.dto';
import { SignInService } from '../services/sessions/sign-in.service';
import { ReservedCode } from '../interfaces/pending-code.interface';
import { activationCodeInvalid } from './activation-error.util';

const logger = new Logger('Activation');

/**
 * Build the account a verified sign-up code describes, inside the caller's
 * transaction. An address that already has an account wins the collision:
 * nothing is overwritten, nobody is signed in, and the answer is the shared
 * failure, so a sign-up never verifies, changes or signs into an account
 * because its address matches.
 *
 * @param reserved - The generation verifyCode compared
 * @param passwordHash - Hash made from the activation password
 * @param name - Name supplied at activation
 * @param userModel - User model used inside the transaction
 * @param session - Transaction the insert must join
 * @param accountId - Id generated before the transaction, so an unknown commit
 *   can be resolved by looking this exact account up afterwards
 * @throws AppException ACTIVATION_CODE_INVALID when an account already exists
 */
export async function createActivatedAccount(
  reserved: ReservedCode,
  passwordHash: string,
  name: string,
  userModel: Model<UserDocument>,
  session: ClientSession,
  accountId: Types.ObjectId,
): Promise<UserDocument> {
  const existing = await userModel
    .findOne({
      email: { $eq: reserved.email },
      isDeleted: { $ne: true },
    })
    .session(session);

  if (existing) {
    throw activationCodeInvalid();
  }

  const user = new userModel({
    _id: accountId,
    email: reserved.email,
    password: passwordHash,
    name,
    isVerified: true,
    authProvider: AuthProvider.EMAIL,
    primaryProvider: AuthProvider.EMAIL,
  });
  try {
    await user.save({ session });
  } catch (error) {
    // A second account for the same address can win between the read and the
    // insert. The caller gets the shared failure and the transaction rolls
    // back, so the code stays usable and no session is issued.
    if (isMongoDuplicateKeyError(error)) {
      throw activationCodeInvalid();
    }
    throw error;
  }
  return user;
}

/**
 * Mark the address verified on the account an admin moved, inside the
 * transaction that consumed the code. The record must still point at the same
 * user and the same address generation, so a superseded change confirms
 * nothing. No session is issued: the user signs in normally.
 *
 * @param reserved - The generation verifyCode compared
 * @param userModel - User model used inside the transaction
 * @param session - Transaction the update must join
 * @throws AppException ACTIVATION_CODE_INVALID for a stale or missing target
 */
export async function confirmEmailChange(
  reserved: ReservedCode,
  userModel: Model<UserDocument>,
  session: ClientSession,
): Promise<void> {
  if (!reserved.userId) {
    throw activationCodeInvalid();
  }

  const user = await userModel
    .findOne({
      _id: reserved.userId,
      isDeleted: { $ne: true },
    })
    .session(session);

  const matchesTarget =
    user !== null &&
    user.email === reserved.email &&
    (user.addressGeneration ?? 0) === (reserved.addressGeneration ?? 0);

  if (!user || !matchesTarget) {
    throw activationCodeInvalid();
  }

  user.isVerified = true;
  await user.save({ session });
}

/**
 * Run the sign-in every other sign-in route runs, so two-step sign-in rules
 * apply after activation. The account is already committed here; a failed
 * sign-in must not read as a failed activation, so the caller is asked to sign
 * in normally instead.
 *
 * @param signInService - The shared sign-in path
 * @param user - The committed account
 * @param response - Response the session cookie is set on
 */
export async function finishActivation(
  signInService: SignInService,
  user: UserDocument,
  response: Response,
): Promise<ApiResponse<ActivateResponseDto>> {
  try {
    const outcome = await signInService.completeSignIn(user, response);
    if (outcome.requiresTwoFactor) {
      return ActivateResponseDto.twoFactorRequired();
    }
    return ActivateResponseDto.success(outcome.user);
  } catch (error) {
    const cause = error instanceof Error ? error.name : typeof error;
    logger.error(
      `Sign-in after activation failed for user ${user._id.toString()} cause=${cause}`,
    );
    return ActivateResponseDto.signInRequired();
  }
}
