import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { PendingRegistrationDocument } from '../schemas/pending-registration.schema';
import { HashService } from '../../common/services/hash.service';
import { Clock } from '../../common/services/clock';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { isMongoDuplicateKeyError } from '../../common/utils/mongo-error.util';
import { generateVerificationCode } from '../utils/verification-code.util';
import { PENDING_STORE_PASSES } from '../constants/pending-store';
import {
  ACTIVATION_CODE_EXPIRES_IN_DEFAULT,
  PendingPurpose,
} from '../constants/registration';
import {
  buildRefreshFilter,
  buildRefreshPipeline,
  buildReplaceFilter,
  buildReplaceUpdate,
  CodeWindow,
} from '../utils/pending-refresh.util';
import {
  IssuedCode,
  RegistrationDetails,
} from '../interfaces/pending-code.interface';

interface StoreInput {
  email: string;
  purpose: PendingPurpose;
  hashedCode: string;
  code: string;
  now: Date;
  details: RegistrationDetails;
  includeExpired: boolean;
  createWhenAbsent: boolean;
}

/**
 * The pending-record store: open, refresh, replace or insert a code record.
 * Separate from code verification, which only reads and deletes a record. A
 * record holds no password and no name: those arrive with the code at
 * activation. The per-address mail cap is the mail counter's responsibility.
 */
export class PendingRegistrationStore {
  private readonly window: CodeWindow;

  constructor(
    private readonly pendingRegistrationModel: Model<PendingRegistrationDocument>,
    private readonly hashService: HashService,
    configService: ConfigService,
    private readonly clock: Clock,
  ) {
    const codeExpiresIn = configService.get<number>(
      'activation.codeExpiresIn',
      ACTIVATION_CODE_EXPIRES_IN_DEFAULT,
    );
    this.window = { codeExpiresIn };
  }

  /**
   * Open or refresh the record. A live record gets a fresh code; an expired
   * record is replaced; an absent one is created. The caller mails only when
   * the mail counter allowed this address.
   */
  async createOrUpdate(
    email: string,
    purpose: PendingPurpose,
    details: RegistrationDetails = {},
  ): Promise<IssuedCode | null> {
    const code = generateVerificationCode();
    const hashedCode = await this.hashService.hash(code);
    return this.storePendingRegistration({
      email,
      purpose,
      hashedCode,
      code,
      now: this.clock.now(),
      details,
      includeExpired: true,
      createWhenAbsent: true,
    });
  }

  /**
   * Reissue the code of an existing record. A live record gets a fresh code;
   * an expired record is dropped. Returns null when nothing was mailed, so
   * every caller answers the generic reply.
   */
  async resend(
    email: string,
    purpose: PendingPurpose,
    details: RegistrationDetails = {},
  ): Promise<IssuedCode | null> {
    const code = generateVerificationCode();
    const hashedCode = await this.hashService.hash(code);
    return this.storePendingRegistration({
      email,
      purpose,
      hashedCode,
      code,
      now: this.clock.now(),
      details,
      includeExpired: false,
      createWhenAbsent: false,
    });
  }

  /**
   * Store the record with filtered atomic writes. A live record is refreshed;
   * an expired one is replaced when the caller allows it; an absent one is
   * created when the caller allows it. A legacy address confirmation under the
   * old unique email index answers null.
   */
  private async storePendingRegistration(
    input: StoreInput,
  ): Promise<IssuedCode | null> {
    for (let pass = 0; pass < PENDING_STORE_PASSES; pass += 1) {
      const refreshed = await this.refreshLiveRegistration(input);
      if (refreshed) return refreshed;

      if (input.includeExpired) {
        const replaced = await this.replaceExpiredRegistration(input);
        if (replaced) return replaced;
      }

      // A record that is left is expired. A resend drops it; a create path
      // already replaced it above.
      const existing = await this.pendingRegistrationModel.exists({
        email: { $eq: input.email },
        purpose: input.purpose,
      });
      if (existing) {
        if (!input.createWhenAbsent) {
          await this.pendingRegistrationModel.deleteOne({
            email: { $eq: input.email },
            purpose: input.purpose,
            expiresAt: { $lte: input.now },
          });
        }
        return null;
      }

      if (!input.createWhenAbsent) {
        return null;
      }

      try {
        await this.pendingRegistrationModel.create({
          email: input.email,
          purpose: input.purpose,
          hashedCode: input.hashedCode,
          attempts: 0,
          expiresAt: new Date(input.now.getTime() + this.window.codeExpiresIn),
          userId: input.details.userId,
          addressGeneration: input.details.addressGeneration,
        });
        return { code: input.code };
      } catch (error) {
        if (!isMongoDuplicateKeyError(error)) throw error;
        if (!(await this.dropLegacySignup(input.email))) return null;
      }
    }

    throw new AppException(
      ErrorCode.INTERNAL_ERROR,
      'Could not store the pending registration',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private async refreshLiveRegistration(
    input: StoreInput,
  ): Promise<IssuedCode | null> {
    const refreshed = await this.pendingRegistrationModel.findOneAndUpdate(
      buildRefreshFilter(input.email, input.purpose, input.now),
      buildRefreshPipeline({
        hashedCode: input.hashedCode,
        now: input.now,
        window: this.window,
        userId: input.details.userId,
        addressGeneration: input.details.addressGeneration,
      }),
      { new: true, select: '_id' },
    );
    return refreshed ? { code: input.code } : null;
  }

  private async replaceExpiredRegistration(
    input: StoreInput,
  ): Promise<IssuedCode | null> {
    const replaced = await this.pendingRegistrationModel.findOneAndUpdate(
      buildReplaceFilter(input.email, input.purpose, input.now),
      buildReplaceUpdate({
        hashedCode: input.hashedCode,
        now: input.now,
        window: this.window,
        userId: input.details.userId,
        addressGeneration: input.details.addressGeneration,
      }),
      { new: true, select: '_id' },
    );
    return replaced ? { code: input.code } : null;
  }

  /**
   * Under the old unique email index a legacy record can block the insert. An
   * old sign-up (it carries a password hash) is dropped and the insert retried;
   * a legacy address confirmation is left alone, because the migration will
   * convert it, and the caller answers generically. A concurrent same-purpose
   * insert is not legacy, so the caller retries.
   */
  private async dropLegacySignup(email: string): Promise<boolean> {
    const deleted = await this.pendingRegistrationModel.deleteOne({
      email: { $eq: email },
      purpose: { $exists: false },
      hashedPassword: { $exists: true },
    });
    if (deleted.deletedCount > 0) {
      return true;
    }

    const legacyConfirmation = await this.pendingRegistrationModel.exists({
      email: { $eq: email },
      purpose: { $exists: false },
      hashedPassword: { $exists: false },
    });
    return legacyConfirmation ? false : true;
  }
}
