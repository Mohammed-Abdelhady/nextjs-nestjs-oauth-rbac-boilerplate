import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_LENGTH,
} from '../constants/two-factor.constants';

/** RFC 4648 base32. 32 characters, so one random byte maps to one character. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * A batch of recovery codes in the clear. The caller shows them once and
 * stores only the hashes.
 */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => generateOne());
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

/**
 * Accept a code the way a person retypes it: any case, with or without the
 * spaces and dashes a password manager may have added.
 */
export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

/** Compares two hex digests without leaking where they start to differ. */
export function recoveryHashEquals(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'hex');
  const rightBytes = Buffer.from(right, 'hex');
  if (leftBytes.length === 0 || leftBytes.length !== rightBytes.length) {
    return false;
  }
  return timingSafeEqual(leftBytes, rightBytes);
}

function generateOne(): string {
  const bytes = randomBytes(RECOVERY_CODE_LENGTH);
  let code = '';
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}
