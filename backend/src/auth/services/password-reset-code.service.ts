import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PendingPasswordReset,
  PendingPasswordResetDocument,
} from '../schemas/pending-password-reset.schema';
import { HashService } from '../../common/services/hash.service';
import { Clock } from '../../common/services/clock';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { isMongoDuplicateKeyError } from '../../common/utils/mongo-error.util';
import { generateVerificationCode } from '../utils/verification-code.util';
import { INVALID_PASSWORD_RESET_CODE_MESSAGE } from '../constants/auth-messages';
import { PENDING_STORE_PASSES } from '../constants/pending-store';

export interface ReservedPasswordReset {
  id: Types.ObjectId;
  hashedCode: string;
}

/**
 * Password reset codes: creation, verification and cleanup.
 */
@Injectable()
export class PasswordResetCodeService {
  private readonly logger = new Logger(PasswordResetCodeService.name);
  private readonly codeExpiresIn: number;
  private readonly maxAttempts: number;

  constructor(
    @InjectModel(PendingPasswordReset.name)
    private readonly pendingPasswordResetModel: Model<PendingPasswordResetDocument>,
    private readonly hashService: HashService,
    private readonly configService: ConfigService,
    private readonly clock: Clock,
  ) {
    this.codeExpiresIn = this.configService.get<number>(
      'activation.codeExpiresIn',
      900000,
    );
    this.maxAttempts = this.configService.get<number>(
      'activation.maxAttempts',
      5,
    );
  }

  /**
   * Store pending password reset code.
   * A filtered atomic write updates an existing record; when it matches
   * nothing there is no record, so the create path runs. A concurrent insert
   * sends the attempt around once more, which updates the record that won. If
   * a reset consumes that record in the window, the next pass creates it
   * again, so the mailed code always has a record behind it.
   *
   * @param email - Address the code belongs to
   * @returns The plain code to mail
   */
  async createOrUpdatePasswordReset(email: string): Promise<string> {
    const code = generateVerificationCode();
    const hashedCode = await this.hashService.hash(code);
    const expiresAt = new Date(this.clock.now().getTime() + this.codeExpiresIn);
    const filter = { email: { $eq: email } };
    const update = { $set: { hashedCode, attempts: 0, expiresAt } };

    for (let pass = 0; pass < PENDING_STORE_PASSES; pass += 1) {
      const updated = await this.pendingPasswordResetModel.updateOne(
        filter,
        update,
      );
      if (updated.matchedCount > 0) {
        this.logger.log(`Opened pending password reset for ${email}`);
        return code;
      }

      try {
        await this.pendingPasswordResetModel.create({
          email,
          hashedCode,
          attempts: 0,
          expiresAt,
        });
        this.logger.log(`Opened pending password reset for ${email}`);
        return code;
      } catch (error) {
        if (!isMongoDuplicateKeyError(error)) throw error;
      }
    }

    throw new AppException(
      ErrorCode.INTERNAL_ERROR,
      'Could not store the pending password reset',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Atomically reserve one attempt, then compare the submitted code.
   * A valid code is not consumed here: the caller must win consumePasswordReset
   * before changing the password so two concurrent winners cannot both proceed.
   *
   * @param email - Address the code was sent to
   * @param code - Code the caller submitted
   * @throws AppException PASSWORD_RESET_CODE_INVALID for a wrong code, no
   * pending record, an expired record or a locked record
   */
  async verifyPasswordReset(
    email: string,
    code: string,
  ): Promise<ReservedPasswordReset> {
    const reserved = await this.pendingPasswordResetModel.findOneAndUpdate(
      {
        email: { $eq: email },
        expiresAt: { $gt: this.clock.now() },
        attempts: { $lt: this.maxAttempts },
      },
      { $inc: { attempts: 1 } },
      { new: true, select: '+hashedCode' },
    );

    if (!reserved) {
      return await this.rejectUnreservable(email, code);
    }

    const isCodeValid = await this.hashService.compare(
      code,
      reserved.hashedCode,
    );

    if (!isCodeValid) {
      throw this.invalidCode();
    }

    return { id: reserved._id, hashedCode: reserved.hashedCode };
  }

  /**
   * Delete the reserved generation. Only the first caller that still holds
   * the hashed code that was compared wins; a refresh or a parallel consume
   * leaves this returning null.
   */
  async consumePasswordReset(
    id: Types.ObjectId,
    hashedCode: string,
  ): Promise<boolean> {
    const deleted = await this.pendingPasswordResetModel.findOneAndDelete({
      _id: id,
      hashedCode,
      expiresAt: { $gt: this.clock.now() },
    });
    return deleted !== null;
  }

  /**
   * The one answer every password reset code step that cannot succeed returns.
   * The attempt limit and the expiry check still decide whether a record can
   * be used; only the answer they produce is shared.
   */
  invalidCode(): AppException {
    return new AppException(
      ErrorCode.PASSWORD_RESET_CODE_INVALID,
      INVALID_PASSWORD_RESET_CODE_MESSAGE,
      HttpStatus.BAD_REQUEST,
    );
  }

  private async rejectUnreservable(
    email: string,
    code: string,
  ): Promise<never> {
    await this.pendingPasswordResetModel.deleteOne({
      email: { $eq: email },
      expiresAt: { $lte: this.clock.now() },
    });

    await this.hashService.spendComparison(code);
    throw this.invalidCode();
  }
}
