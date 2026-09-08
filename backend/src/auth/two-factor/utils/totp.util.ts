import { generateSecret, generateURI, verifySync } from 'otplib';
import {
  TOTP_DIGITS,
  TOTP_STEP_SECONDS,
  TWO_FACTOR_ISSUER,
  TWO_FACTOR_WINDOW,
} from '../constants/two-factor.constants';

/**
 * The only place that talks to otplib. Everything else works with the three
 * functions below, which keeps the library swappable and lets the specs stand
 * in for it without generating real codes.
 *
 * Written against otplib 13, whose functional API takes plain option objects.
 */

/** otplib counts tolerance in seconds, so the window is converted here. */
const EPOCH_TOLERANCE_SECONDS = TWO_FACTOR_WINDOW * TOTP_STEP_SECONDS;

const CODE_PATTERN = new RegExp(`^\\d{${TOTP_DIGITS}}$`);

/** A fresh base32 secret, the format authenticator apps expect. */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** The otpauth:// URL an authenticator app reads out of a QR code. */
export function buildOtpauthUrl(accountName: string, secret: string): string {
  return generateURI({
    issuer: TWO_FACTOR_ISSUER,
    label: accountName,
    secret,
    digits: TOTP_DIGITS,
    period: TOTP_STEP_SECONDS,
  });
}

/**
 * How far the code sits from the current step, or null when it does not match
 * inside the window. The caller needs the distance to reject a replayed code.
 *
 * The shape check comes first because otplib throws on a code of the wrong
 * length rather than reporting it as a mismatch, and a wrong code is the
 * ordinary case on this path.
 */
export function checkTotpDelta(code: string, secret: string): number | null {
  if (!CODE_PATTERN.test(code)) {
    return null;
  }

  const result = verifySync({
    secret,
    token: code,
    digits: TOTP_DIGITS,
    period: TOTP_STEP_SECONDS,
    epochTolerance: EPOCH_TOLERANCE_SECONDS,
  });

  return result.valid ? result.delta : null;
}
