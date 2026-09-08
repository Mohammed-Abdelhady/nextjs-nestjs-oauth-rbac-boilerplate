import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PendingRegistration,
  PendingRegistrationDocument,
} from '../schemas/pending-registration.schema';
import { HashService } from '../../common/services/hash.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { generateVerificationCode } from '../utils/verification-code.util';

export interface ConsumedRegistration {
  email: string;
  name: string;
  hashedPassword?: string;
}

export interface PendingCodeData {
  code: string;
  name: string;
}

/**
 * Activation codes for pending registrations.
 */
@Injectable()
export class VerificationCodeService {
  private readonly logger = new Logger(VerificationCodeService.name);
  private readonly codeExpiresIn: number;
  private readonly maxAttempts: number;

  constructor(
    @InjectModel(PendingRegistration.name)
    private readonly pendingRegistrationModel: Model<PendingRegistrationDocument>,
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
   * Open or refresh the pending registration for an address.
   * An unexpired pending record keeps the name and password it was created
   * with, so a later attempt on the same address only gets a fresh code mailed
   * to that address. Once the record expires the new details replace it.
   * The password hash is omitted when the code only proves ownership of a new
   * address for an account that already exists.
   *
   * @param email - Address the code is mailed to
   * @param name - Name to store when the record is created or replaced
   * @param hashedPassword - Password hash to store, absent for email changes
   * @returns The plain code to mail and the name the record holds
   */
  async createOrUpdatePendingRegistration(
    email: string,
    name: string,
    hashedPassword?: string,
  ): Promise<PendingCodeData> {
    const existingPending = await this.pendingRegistrationModel
      .findOne({ email })
      .select('+hashedPassword +hashedCode');

    if (existingPending && existingPending.expiresAt > new Date()) {
      const code = await this.refreshCode(existingPending);
      this.logger.log(`Reissued code for pending registration of ${email}`);
      return { code, name: existingPending.name };
    }

    const code = generateVerificationCode();
    const hashedCode = await this.hashService.hash(code);
    const expiresAt = new Date(Date.now() + this.codeExpiresIn);

    if (existingPending) {
      existingPending.hashedPassword = hashedPassword;
      existingPending.name = name;
      existingPending.hashedCode = hashedCode;
      existingPending.attempts = 0;
      existingPending.expiresAt = expiresAt;
      await existingPending.save();
      this.logger.log(`Replaced expired pending registration for ${email}`);
      return { code, name };
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
    return { code, name };
  }

  /**
   * Verify activation code and remove pending registration record.
   *
   * @param email - Address the code was sent to
   * @param code - Code the caller submitted
   * @returns The details the registration was created with
   * @throws AppException NO_PENDING_REGISTRATION, ACTIVATION_CODE_EXPIRED,
   * MAX_ATTEMPTS_EXCEEDED or ACTIVATION_CODE_INVALID
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
   * Regenerate the activation code of an existing pending registration.
   * An expired record is dropped instead of revived, so the next registration
   * starts from the details it was given.
   *
   * @param email - Address the code is mailed to
   * @returns The plain code and the stored name, or null when nothing is pending
   */
  async resendActivationCode(email: string): Promise<PendingCodeData | null> {
    const pending = await this.pendingRegistrationModel
      .findOne({ email })
      .select('+hashedCode');

    if (!pending) {
      return null;
    }

    if (new Date() > pending.expiresAt) {
      await this.pendingRegistrationModel.deleteOne({ email });
      return null;
    }

    const code = await this.refreshCode(pending);
    this.logger.log(`Resent activation code for ${email}`);
    return { code, name: pending.name };
  }

  /**
   * Put a new code on a pending record, leaving its name and password alone.
   */
  private async refreshCode(
    pending: PendingRegistrationDocument,
  ): Promise<string> {
    const code = generateVerificationCode();

    pending.hashedCode = await this.hashService.hash(code);
    pending.attempts = 0;
    pending.expiresAt = new Date(Date.now() + this.codeExpiresIn);
    await pending.save();

    return code;
  }
}
