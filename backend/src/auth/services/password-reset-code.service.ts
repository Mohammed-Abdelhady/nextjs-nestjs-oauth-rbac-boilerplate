import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PendingPasswordReset,
  PendingPasswordResetDocument,
} from '../schemas/pending-password-reset.schema';
import { HashService } from '../../common/services/hash.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { generateVerificationCode } from '../utils/verification-code.util';

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
   *
   * @param email - Address the code belongs to
   * @returns The plain code to mail
   */
  async createOrUpdatePasswordReset(email: string): Promise<string> {
    const code = generateVerificationCode();
    const hashedCode = await this.hashService.hash(code);
    const expiresAt = new Date(Date.now() + this.codeExpiresIn);

    const existingReset = await this.pendingPasswordResetModel
      .findOne({ email: { $eq: email } })
      .select('+hashedCode');

    if (existingReset) {
      existingReset.hashedCode = hashedCode;
      existingReset.attempts = 0;
      existingReset.expiresAt = expiresAt;
      await existingReset.save();
      this.logger.log(`Updated pending password reset for ${email}`);
      return code;
    }

    await this.pendingPasswordResetModel.create({
      email,
      hashedCode,
      attempts: 0,
      expiresAt,
    });

    this.logger.log(`Created pending password reset for ${email}`);
    return code;
  }

  /**
   * Atomically reserve one attempt, then compare the submitted code.
   * A valid code is not consumed here: the caller must win consumePasswordReset
   * before changing the password so two concurrent winners cannot both proceed.
   *
   * @param email - Address the code was sent to
   * @param code - Code the caller submitted
   * @throws AppException NO_PENDING_PASSWORD_RESET, PASSWORD_RESET_CODE_EXPIRED,
   * MAX_ATTEMPTS_EXCEEDED or PASSWORD_RESET_CODE_INVALID
   */
  async verifyPasswordReset(
    email: string,
    code: string,
  ): Promise<ReservedPasswordReset> {
    const reserved = await this.pendingPasswordResetModel.findOneAndUpdate(
      {
        email: { $eq: email },
        expiresAt: { $gt: new Date() },
        attempts: { $lt: this.maxAttempts },
      },
      { $inc: { attempts: 1 } },
      { new: true, select: '+hashedCode' },
    );

    if (!reserved) {
      return await this.rejectUnreservable(email);
    }

    const isCodeValid = await this.hashService.compare(
      code,
      reserved.hashedCode,
    );

    if (!isCodeValid) {
      const remainingAttempts = Math.max(
        0,
        this.maxAttempts - reserved.attempts,
      );

      if (reserved.attempts >= this.maxAttempts) {
        throw new AppException(
          ErrorCode.MAX_ATTEMPTS_EXCEEDED,
          'Maximum attempts exceeded. Please request a new code.',
          HttpStatus.UNAUTHORIZED,
        );
      }

      throw new AppException(
        ErrorCode.PASSWORD_RESET_CODE_INVALID,
        `Invalid code. ${remainingAttempts} attempts remaining.`,
        HttpStatus.BAD_REQUEST,
        { remainingAttempts },
      );
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
      expiresAt: { $gt: new Date() },
    });
    return deleted !== null;
  }

  /**
   * Remove pending password reset after successful password update.
   *
   * @param email - Address the reset belonged to
   */
  async clearPasswordReset(email: string): Promise<void> {
    await this.pendingPasswordResetModel.deleteOne({
      email: { $eq: email },
    });
  }

  private async rejectUnreservable(email: string): Promise<never> {
    const pending = await this.pendingPasswordResetModel.findOne({
      email: { $eq: email },
    });

    if (!pending) {
      throw new AppException(
        ErrorCode.NO_PENDING_PASSWORD_RESET,
        'No password reset request found',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (new Date() > pending.expiresAt) {
      await this.pendingPasswordResetModel.deleteOne({ _id: pending._id });
      throw new AppException(
        ErrorCode.PASSWORD_RESET_CODE_EXPIRED,
        'Password reset code has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    throw new AppException(
      ErrorCode.MAX_ATTEMPTS_EXCEEDED,
      'Maximum attempts exceeded. Please request a new code.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
