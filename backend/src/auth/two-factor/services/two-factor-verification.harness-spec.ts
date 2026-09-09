import { ConfigService } from '@nestjs/config';
import { generateSync } from 'otplib';
import { TwoFactorVerificationService } from './two-factor-verification.service';
import { TotpSecretCryptoService } from './totp-secret-crypto.service';
import { generateTotpSecret } from '../utils/totp.util';
import { hashRecoveryCode } from '../utils/recovery-code.util';
import { UserDocument } from '../../../user/schemas/user.schema';
import {
  TOTP_DIGITS,
  TOTP_STEP_MS,
  TOTP_STEP_SECONDS,
} from '../constants/two-factor.constants';

/**
 * Shared setup for the verification specs, which run against real codes.
 * The file ends in -spec.ts rather than .spec.ts: the build excludes it and
 * jest does not collect it as a suite of its own.
 */

const KEY = Buffer.alloc(32, 7).toString('base64');

export const RECOVERY_CODE = 'K3M7QRTVWX';

/**
 * A point in the middle of a step. Freezing the clock here keeps the step
 * arithmetic exact; a run that crossed a boundary would read one step out.
 */
export const FIXED_EPOCH_SECONDS = 1700000000;
export const FIXED_NOW_MS = FIXED_EPOCH_SECONDS * 1000;
export const CURRENT_STEP = Math.floor(FIXED_NOW_MS / TOTP_STEP_MS);

/** A code as an authenticator app would show it at the given step offset. */
export function codeAtOffset(secret: string, steps: number): string {
  return generateSync({
    secret,
    epoch: FIXED_EPOCH_SECONDS + steps * TOTP_STEP_SECONDS,
    period: TOTP_STEP_SECONDS,
    digits: TOTP_DIGITS,
  });
}

export interface MockUser {
  _id: string;
  twoFactor: {
    enabled: boolean;
    secret: { ciphertext: string; iv: string; tag: string } | null;
    confirmedAt: Date | null;
    recoveryCodes: { hash: string; usedAt: Date | null }[];
    lastUsedStep: number | null;
  };
  save: jest.Mock;
  markModified: jest.Mock;
}

export interface VerificationHarness {
  service: TwoFactorVerificationService;
  secret: string;
  user: MockUser;
  userModel: { updateOne: jest.Mock };
}

export function createVerificationHarness(
  overrides: Partial<MockUser['twoFactor']> = {},
): VerificationHarness {
  const crypto = new TotpSecretCryptoService({
    get: <T>(key: string): T | undefined =>
      key === 'twoFactor.encryptionKey' ? (KEY as T) : undefined,
  } as unknown as ConfigService);

  const secret = generateTotpSecret();
  const userModel = {
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };

  return {
    service: new TwoFactorVerificationService(userModel as never, crypto),
    secret,
    userModel,
    user: {
      _id: '507f1f77bcf86cd799439011',
      twoFactor: {
        enabled: true,
        secret: crypto.encrypt(secret),
        confirmedAt: new Date(),
        recoveryCodes: [
          { hash: hashRecoveryCode(RECOVERY_CODE), usedAt: null },
        ],
        lastUsedStep: null,
        ...overrides,
      },
      save: jest.fn().mockResolvedValue(undefined),
      markModified: jest.fn(),
    },
  };
}

/** The mock user, typed the way the service expects it. */
export function asDocument(user: MockUser): UserDocument {
  return user as unknown as UserDocument;
}
