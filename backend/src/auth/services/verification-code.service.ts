import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import {
  PendingRegistration,
  PendingRegistrationDocument,
} from '../schemas/pending-registration.schema';
import {
  PendingPasswordReset,
  PendingPasswordResetDocument,
} from '../schemas/pending-password-reset.schema';
import { HashService } from '../../common/services/hash.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';

export interface ConsumedRegistration {
  email: string;
  name: string;
  hashedPassword?: string;
}

export interface ResentCodeData {
  code: string;
  name: string;
}

@Injectable()
export class VerificationCodeService {
  private readonly logger = new Logger(VerificationCodeService.name);
  private readonly codeExpiresIn: number;
  private readonly maxAttempts: number;

  constructor(
    @InjectModel(PendingRegistration.name)
    private readonly pendingRegistrationModel: Model<PendingRegistrationDocument>,
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
   * Generate a random 6-digit verification code.
   */
  generateCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Store pending registration code and details.
   * The password hash is omitted when the code only proves ownership of a new
   * address for an account that already exists.
   */
  async createOrUpdatePendingRegistration(
    email: string,
    name: string,
    hashedPassword?: string,
  ): Promise<string> {
    const code = this.generateCode();
    const hashedCode = await this.hashService.hash(code);
    const expiresAt = new Date(Date.now() + this.codeExpiresIn);

    const existingPending = await this.pendingRegistrationModel
      .findOne({ email })
      .select('+hashedPassword +hashedCode');

    if (existingPending) {
      existingPending.hashedPassword = hashedPassword;
      existingPending.name = name;
      existingPending.hashedCode = hashedCode;
      existingPending.attempts = 0;
      existingPending.expiresAt = expiresAt;
      await existingPending.save();
      this.logger.log(`Updated pending registration for ${email}`);
      return code;
    }

    await this.pendingRegistrationModel.create({
      email,
      hashedPassword,
      name,
      hashedCode,
      attempts: 0,
      expiresAt,
    });

    this.logger.log(`Created pending registration for ${email}`);
    return code;
  }

  /**
   * Verify activation code and remove pending registration record.
   */
  async verifyAndConsumeRegistration(
    email: string,
    code: string,
  ): Promise<ConsumedRegistration> {
    const pending = await this.pendingRegistrationModel
      .findOne({ email })
      .select('+hashedPassword +hashedCode');

    if (!pending) {
      throw new AppException(
        ErrorCode.NO_PENDING_REGISTRATION,
        'No pending registration found',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (new Date() > pending.expiresAt) {
      await this.pendingRegistrationModel.deleteOne({ email });
      throw new AppException(
        ErrorCode.ACTIVATION_CODE_EXPIRED,
        'Activation code has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (pending.attempts >= this.maxAttempts) {
      await this.pendingRegistrationModel.deleteOne({ email });
      throw new AppException(
        ErrorCode.MAX_ATTEMPTS_EXCEEDED,
        'Maximum attempts exceeded. Please register again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isCodeValid = await this.hashService.compare(
      code,
      pending.hashedCode,
    );

    if (!isCodeValid) {
      const updated = await this.pendingRegistrationModel.findOneAndUpdate(
        { email },
        { $inc: { attempts: 1 } },
        { new: true },
      );

      const attempts = updated ? updated.attempts : pending.attempts + 1;
      const remainingAttempts = Math.max(0, this.maxAttempts - attempts);

      throw new AppException(
        ErrorCode.ACTIVATION_CODE_INVALID,
        `Invalid code. ${remainingAttempts} attempts remaining.`,
        HttpStatus.BAD_REQUEST,
        { remainingAttempts },
      );
    }

    await this.pendingRegistrationModel.deleteOne({ email });

    return {
      email: pending.email,
      name: pending.name,
      hashedPassword: pending.hashedPassword,
    };
  }

  /**
   * Regenerate activation code for an existing pending registration.
   */
  async resendActivationCode(email: string): Promise<ResentCodeData> {
    const pending = await this.pendingRegistrationModel
      .findOne({ email })
      .select('+hashedPassword +hashedCode');

    if (!pending) {
      throw new AppException(
        ErrorCode.NO_PENDING_REGISTRATION_FOR_RESEND,
        'No pending registration found. Please register again.',
        HttpStatus.NOT_FOUND,
      );
    }

    const code = this.generateCode();
    const hashedCode = await this.hashService.hash(code);
    const expiresAt = new Date(Date.now() + this.codeExpiresIn);

    pending.hashedCode = hashedCode;
    pending.attempts = 0;
    pending.expiresAt = expiresAt;
    await pending.save();

    this.logger.log(`Resent activation code for ${email}`);
    return { code, name: pending.name };
  }

  /**
   * Store pending password reset code.
   */
  async createOrUpdatePasswordReset(email: string): Promise<string> {
    const code = this.generateCode();
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
   */
  async clearPasswordReset(email: string): Promise<void> {
    await this.pendingPasswordResetModel.deleteOne({ email });
  }
}
