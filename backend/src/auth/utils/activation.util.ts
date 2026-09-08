import { HttpStatus } from '@nestjs/common';
import { Model } from 'mongoose';
import { UserDocument } from '../../user/schemas/user.schema';
import { AuthProvider } from '../../user/enums/auth-provider.enum';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { ConsumedRegistration } from '../services/verification-code.service';

/**
 * Resolve the account a verified activation code belongs to.
 * A pending record without a password hash verifies a new address on an
 * account that already exists, which is how admin-initiated email changes are
 * confirmed. Anything else creates the account the registration described.
 *
 * @param pending - Consumed pending registration
 * @param userModel - User model used for the lookup and the insert
 * @throws AppException EMAIL_ALREADY_EXISTS when the account is already verified
 */
export async function resolveActivatedUser(
  pending: ConsumedRegistration,
  userModel: Model<UserDocument>,
): Promise<UserDocument> {
  const existing = await userModel.findOne({
    email: pending.email,
    isDeleted: { $ne: true },
  });

  if (existing) {
    if (existing.isVerified) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'Email already registered',
        HttpStatus.CONFLICT,
      );
    }

    existing.isVerified = true;
    await existing.save();
    return existing;
  }

  if (!pending.hashedPassword) {
    throw new AppException(
      ErrorCode.NO_PENDING_REGISTRATION,
      'No pending registration found',
      HttpStatus.BAD_REQUEST,
    );
  }

  return userModel.create({
    email: pending.email,
    password: pending.hashedPassword,
    name: pending.name,
    isVerified: true,
    authProvider: AuthProvider.EMAIL,
    primaryProvider: AuthProvider.EMAIL,
  });
}
