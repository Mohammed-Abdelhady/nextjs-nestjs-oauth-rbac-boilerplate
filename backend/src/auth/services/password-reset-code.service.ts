import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PendingPasswordReset,
  PendingPasswordResetDocument,
} from '../schemas/pending-password-reset.schema';
import { HashService } from '../../common/services/hash.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { generateVerificationCode } from '../utils/verification-code.util';

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
      .findOne({ email })
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
   * Verify password reset code and atomically increment attempts on failure.
   *
   * @param email - Address the code was sent to
   * @param code - Code the caller submitted
   * @throws AppException NO_PENDING_PASSWORD_RESET, PASSWORD_RESET_CODE_EXPIRED,
   * MAX_ATTEMPTS_EXCEEDED or PASSWORD_RESET_CODE_INVALID
   */
  async verifyPasswordReset(email: string, code: string): Promise<void> {
    const pending = await this.pendingPasswordResetModel
      .findOne({ email })
      .select('+hashedCode');

    if (!pending) {
      throw new AppException(
        ErrorCode.NO_PENDING_PASSWORD_RESET,
        'No password reset request found',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (new Date() > pending.expiresAt) {
      await this.pendingPasswordResetModel.deleteOne({ email });
      throw new AppException(
        ErrorCode.PASSWORD_RESET_CODE_EXPIRED,
        'Password reset code has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (pending.attempts >= this.maxAttempts) {
      await this.pendingPasswordResetModel.deleteOne({ email });
      throw new AppException(
        ErrorCode.MAX_ATTEMPTS_EXCEEDED,
        'Maximum attempts exceeded. Please request a new code.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isCodeValid = await this.hashService.compare(
      code,
      pending.hashedCode,
    );

    if (!isCodeValid) {
      const updated = await this.pendingPasswordResetModel.findOneAndUpdate(
        { email },
        { $inc: { attempts: 1 } },
        { new: true },
      );

      const attempts = updated ? updated.attempts : pending.attempts + 1;
      const remainingAttempts = Math.max(0, this.maxAttempts - attempts);

      throw new AppException(
        ErrorCode.PASSWORD_RESET_CODE_INVALID,
        `Invalid code. ${remainingAttempts} attempts remaining.`,
        HttpStatus.BAD_REQUEST,
        { remainingAttempts },
      );
    }
  }

  /**
   * Remove pending password reset after successful password update.
   *
   * @param email - Address the reset belonged to
   */
  async clearPasswordReset(email: string): Promise<void> {
    await this.pendingPasswordResetModel.deleteOne({ email });
  }
}
