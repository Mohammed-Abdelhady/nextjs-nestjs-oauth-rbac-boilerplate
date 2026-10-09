/**
 * Password validation rule IDs matching requirements from zod schema.
 */
export type PasswordRuleId = 'minLength' | 'uppercase' | 'lowercase' | 'number';

export interface PasswordRuleResult {
  id: PasswordRuleId;
  passed: boolean;
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * bcrypt reads at most 72 bytes of input; a longer password would be silently
 * truncated. The server, the change form and the reset form all enforce this
 * one byte ceiling, so no two paths can disagree about the credential.
 */
export const MAX_PASSWORD_BYTES = 72;

/** UTF-8 byte length of a password, the unit bcrypt actually limits. */
export function passwordByteLength(password: string): number {
  let bytes = 0;
  for (const character of password || '') {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/** True when the password fits in the bytes bcrypt reads. */
export function isPasswordWithinByteLimit(
  password: string,
  maxBytes = MAX_PASSWORD_BYTES,
): boolean {
  return passwordByteLength(password) <= maxBytes;
}

/**
 * The one password rule, worded once. The backend mirrors this string and the
 * drift spec keeps the two in step.
 */
export const PASSWORD_REQUIREMENTS_MESSAGE =
  `Password must be at least ${MIN_PASSWORD_LENGTH} characters, include an ` +
  'uppercase letter, a lowercase letter and a number, and must not exceed ' +
  `${MAX_PASSWORD_BYTES} bytes`;

/** Swagger/form description for the one password rule. */
export const PASSWORD_POLICY_DESCRIPTION =
  `At least ${MIN_PASSWORD_LENGTH} characters with an uppercase letter, a ` +
  `lowercase letter and a number; at most ${MAX_PASSWORD_BYTES} bytes`;

/**
 * Evaluates a password string against complexity rules.
 *
 * @param password - Password to test
 * @param minLength - Minimum length required (default 8)
 * @returns Array of evaluated rule results
 */
export function evaluatePasswordRules(
  password: string,
  minLength = MIN_PASSWORD_LENGTH,
): PasswordRuleResult[] {
  const value = password || '';
  return [
    { id: 'minLength', passed: value.length >= minLength },
    { id: 'uppercase', passed: /[A-Z]/.test(value) },
    { id: 'lowercase', passed: /[a-z]/.test(value) },
    { id: 'number', passed: /\d/.test(value) },
  ];
}

/**
 * Returns true if all password rules pass.
 *
 * @param password - Password to test
 * @param minLength - Minimum length required (default 8)
 */
export function areAllPasswordRulesPassed(
  password: string,
  minLength = MIN_PASSWORD_LENGTH,
): boolean {
  return evaluatePasswordRules(password, minLength).every((rule) => rule.passed);
}
