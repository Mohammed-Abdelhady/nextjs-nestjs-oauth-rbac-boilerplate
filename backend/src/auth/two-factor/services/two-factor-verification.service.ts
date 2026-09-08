import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UserDocument } from '../../../user/schemas/user.schema';
import { TwoFactorSecret } from '../../../user/schemas/two-factor.schema';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { TotpSecretCryptoService } from './totp-secret-crypto.service';
import { checkTotpDelta } from '../utils/totp.util';
import {
  hashRecoveryCode,
  recoveryHashEquals,
} from '../utils/recovery-code.util';
import { TOTP_STEP_MS } from '../constants/two-factor.constants';

/** What a caller may send as the second factor. Exactly one is used. */
export interface SecondFactorInput {
  code?: string;
  recoveryCode?: string;
}

/**
 * Checks a second factor and records that it was spent. Every route that asks
 * for a code goes through here, so replay protection and single-use recovery
 * codes hold everywhere and not only on the login path.
 */
@Injectable()
export class TwoFactorVerificationService {
  private readonly logger = new Logger(TwoFactorVerificationService.name);

  constructor(private readonly cryptoService: TotpSecretCryptoService) {}

  /**
   * @throws AppException TWO_FACTOR_CODE_INVALID when neither field is filled
   * in, or when the value in it does not match
   */
  async verifySecondFactor(
    user: UserDocument,
    input: SecondFactorInput,
  ): Promise<void> {
    if (input.code) {
      await this.verifyTotpCode(user, input.code);
      return;
    }

    if (input.recoveryCode) {
      await this.verifyRecoveryCode(user, input.recoveryCode);
      return;
    }

    throw this.invalidCode('neither a code nor a recovery code was sent');
  }

  /**
   * Checks a code against the secret on the account, whether or not the second
   * factor is confirmed yet, and marks the step as spent.
   */
  async verifyTotpCode(user: UserDocument, code: string): Promise<void> {
    const secret = user.twoFactor?.secret;
    if (!secret) {
      throw this.invalidCode('account has no secret to check against');
    }

    const step = this.resolveStep(secret, code);
    const lastUsedStep = user.twoFactor.lastUsedStep;

    if (typeof lastUsedStep === 'number' && step <= lastUsedStep) {
      throw this.invalidCode('code was already used');
    }

    user.twoFactor.lastUsedStep = step;
    await user.save();
  }

  /** Spends one recovery code. A code that was already spent is refused. */
  async verifyRecoveryCode(
    user: UserDocument,
    recoveryCode: string,
  ): Promise<void> {
    const hash = hashRecoveryCode(recoveryCode);
    const match = (user.twoFactor?.recoveryCodes ?? []).find(
      (candidate) =>
        candidate.usedAt === null && recoveryHashEquals(candidate.hash, hash),
    );

    if (!match) {
      throw this.invalidCode('recovery code is unknown or already used');
    }

    match.usedAt = new Date();
    user.markModified('twoFactor.recoveryCodes');
    await user.save();
  }

  /**
   * The absolute TOTP step the code belongs to, counted from the epoch. Steps
   * only ever move forward, which is what makes a spent one detectable.
   */
  private resolveStep(secret: TwoFactorSecret, code: string): number {
    const delta = checkTotpDelta(code, this.cryptoService.decrypt(secret));

    if (delta === null || delta === undefined) {
      throw this.invalidCode('code does not match the secret');
    }

    return Math.floor(Date.now() / TOTP_STEP_MS) + delta;
  }

  private invalidCode(reason: string): AppException {
    this.logger.warn(`Two-factor check failed: ${reason}`);
    return new AppException(
      ErrorCode.TWO_FACTOR_CODE_INVALID,
      'That code is not valid',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
