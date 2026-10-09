export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt reads at most 72 bytes of input, so a longer password would be
 * silently truncated. Sign-up, activation, change, reset and admin creation
 * all share this one ceiling and reject a password that does not fit in bytes.
 */
export const PASSWORD_MAX_BYTES = 72;

/**
 * The one password rule, worded once. Every DTO uses it through
 * `@PasswordPolicy`, and the Swagger text is built from it.
 */
export const PASSWORD_REQUIREMENTS_MESSAGE =
  `Password must be at least ${PASSWORD_MIN_LENGTH} characters, include an ` +
  'uppercase letter, a lowercase letter and a number, and must not exceed ' +
  `${PASSWORD_MAX_BYTES} bytes`;

/** Swagger description for the one password rule. */
export const PASSWORD_POLICY_DESCRIPTION =
  `At least ${PASSWORD_MIN_LENGTH} characters with an uppercase letter, a ` +
  `lowercase letter and a number; at most ${PASSWORD_MAX_BYTES} bytes`;
