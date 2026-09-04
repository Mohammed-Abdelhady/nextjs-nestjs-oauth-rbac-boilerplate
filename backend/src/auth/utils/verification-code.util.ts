import * as crypto from 'crypto';

/**
 * Generate a random 6-digit verification code.
 *
 * @returns Six digits as a string
 */
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}
