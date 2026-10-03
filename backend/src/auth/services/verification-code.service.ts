import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PendingRegistration,
  PendingRegistrationDocument,
} from '../schemas/pending-registration.schema';
import { HashService } from '../../common/services/hash.service';
import { Clock } from '../../common/services/clock';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { isMongoDuplicateKeyError } from '../../common/utils/mongo-error.util';
import { generateVerificationCode } from '../utils/verification-code.util';
import { INVALID_ACTIVATION_CODE_MESSAGE } from '../constants/auth-messages';
import { PENDING_STORE_PASSES } from '../constants/pending-store';

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
    const code = generateVerificationCode();
    const hashedCode = await this.hashService.hash(code);
    const expiresAt = new Date(this.clock.now().getTime() + this.codeExpiresIn);

    const storedName = await this.storePendingRegistration({
      email,
      name,
      hashedPassword,
      hashedCode,
      expiresAt,
    });

    this.logger.log(`Opened pending registration for ${email}`);
    return { code, name: storedName };
  }

  /**
   * Store the pending registration with filtered atomic writes.
   * A live record is refreshed in place and keeps the name and password it was
   * created with; an expired record is replaced with the new details; an
   * absent record is created. If a concurrent request wins the insert, the
   * whole sequence runs once more, so the loser only refreshes the code and
   * returns the stored name. No write matches a record that is gone, so a
   * concurrent delete cannot surface as an error: the next pass creates it.
   * After two full passes without a successful write it gives up.
   */
  private async storePendingRegistration(input: {
    email: string;
    name: string;
    hashedPassword?: string;
    hashedCode: string;
    expiresAt: Date;
  }): Promise<string> {
    for (let pass = 0; pass < PENDING_STORE_PASSES; pass += 1) {
      const refreshed = await this.refreshLiveRegistration(input);
      if (refreshed !== null) return refreshed;

      const replaced = await this.replaceExpiredRegistration(input);
      if (replaced !== null) return replaced;

      try {
        await this.pendingRegistrationModel.create({
          email: input.email,
          hashedPassword: input.hashedPassword,
          name: input.name,
          hashedCode: input.hashedCode,
          attempts: 0,
          expiresAt: input.expiresAt,
        });
        return input.name;
      } catch (error) {
        if (!isMongoDuplicateKeyError(error)) throw error;
      }
    }

    throw new AppException(
      ErrorCode.INTERNAL_ERROR,
      'Could not store the pending registration',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /** Refresh the code of a live record, leaving its name and password alone. */
  private async refreshLiveRegistration(input: {
    email: string;
    hashedCode: string;
    expiresAt: Date;
  }): Promise<string | null> {
    const live = await this.pendingRegistrationModel.findOneAndUpdate(
      { email: { $eq: input.email }, expiresAt: { $gt: this.clock.now() } },
      {
        $set: {
          hashedCode: input.hashedCode,
          attempts: 0,
          expiresAt: input.expiresAt,
        },
      },
      { new: true, select: 'name' },
    );
    return live ? live.name : null;
  }

  /** Replace an expired record with the details of this request. */
  private async replaceExpiredRegistration(input: {
    email: string;
    name: string;
    hashedPassword?: string;
    hashedCode: string;
    expiresAt: Date;
  }): Promise<string | null> {
    const fields = {
      name: input.name,
      hashedCode: input.hashedCode,
      attempts: 0,
      expiresAt: input.expiresAt,
    };
    const replaced = await this.pendingRegistrationModel.findOneAndUpdate(
      { email: { $eq: input.email }, expiresAt: { $lte: this.clock.now() } },
      input.hashedPassword === undefined
        ? { $set: fields, $unset: { hashedPassword: '' } }
        : { $set: { ...fields, hashedPassword: input.hashedPassword } },
      { new: true, select: 'name' },
    );
    return replaced ? replaced.name : null;
  }

  /**
   * Atomically reserve one attempt, compare the code, then consume only the
   * generation that was compared. A refresh that lands during the compare
   * changes hashedCode, so the stale caller cannot delete the new record.
   *
   * @param email - Address the code was sent to
   * @param code - Code the caller submitted
   * @returns The details the registration was created with
   * @throws AppException ACTIVATION_CODE_INVALID for a wrong code, no pending
   * record, an expired record or a locked record
   */
  async verifyAndConsumeRegistration(
    email: string,
    code: string,
  ): Promise<ConsumedRegistration> {
    const reserved = await this.pendingRegistrationModel.findOneAndUpdate(
      {
        email: { $eq: email },
        expiresAt: { $gt: this.clock.now() },
        attempts: { $lt: this.maxAttempts },
      },
      { $inc: { attempts: 1 } },
      { new: true, select: '+hashedPassword +hashedCode' },
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

    const consumed = await this.pendingRegistrationModel.findOneAndDelete({
      _id: reserved._id,
      hashedCode: reserved.hashedCode,
      expiresAt: { $gt: this.clock.now() },
    });

    if (!consumed) {
      throw this.invalidCode();
    }

    return {
      email: reserved.email,
      name: reserved.name,
      hashedPassword: reserved.hashedPassword,
    };
  }

  /**
   * Regenerate the activation code of an existing pending registration.
   * The code is generated and hashed first, so every resend path spends the
   * same one hash. A live record gets the fresh code in one filtered write; an
   * expired record is dropped instead of revived, so the next registration
   * starts from the details it was given.
   *
   * @param email - Address the code is mailed to
   * @returns The plain code and the stored name, or null when nothing is pending
   */
  async resendActivationCode(email: string): Promise<PendingCodeData | null> {
    const code = generateVerificationCode();
    const hashedCode = await this.hashService.hash(code);
    const expiresAt = new Date(this.clock.now().getTime() + this.codeExpiresIn);

    const refreshed = await this.refreshLiveRegistration({
      email,
      hashedCode,
      expiresAt,
    });
    if (refreshed !== null) {
      this.logger.log(`Resent activation code for ${email}`);
      return { code, name: refreshed };
    }

    await this.pendingRegistrationModel.deleteOne({
      email: { $eq: email },
      expiresAt: { $lte: this.clock.now() },
    });
    return null;
  }

  /**
   * The one answer every activation code step that cannot succeed returns.
   * The attempt limit and the expiry check still decide whether a record can
   * be used; only the answer they produce is shared.
   */
  private invalidCode(): AppException {
    return new AppException(
      ErrorCode.ACTIVATION_CODE_INVALID,
      INVALID_ACTIVATION_CODE_MESSAGE,
      HttpStatus.BAD_REQUEST,
    );
  }

  private async rejectUnreservable(
    email: string,
    code: string,
  ): Promise<never> {
    await this.pendingRegistrationModel.deleteOne({
      email: { $eq: email },
      expiresAt: { $lte: this.clock.now() },
    });

    await this.hashService.spendComparison(code);
    throw this.invalidCode();
  }
}
