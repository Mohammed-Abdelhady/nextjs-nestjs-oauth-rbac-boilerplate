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
