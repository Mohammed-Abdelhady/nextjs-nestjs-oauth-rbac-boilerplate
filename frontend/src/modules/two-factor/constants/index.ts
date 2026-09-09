/** Digits in a TOTP code. Every authenticator app shows six. */
export const TOTP_CODE_LENGTH = 6;

/** Characters in a recovery code, before the reader adds spaces or dashes. */
export const RECOVERY_CODE_LENGTH = 10;

/** Filename the recovery codes download under. */
export const RECOVERY_CODES_FILENAME = 'recovery-codes.txt';

export const TWO_FACTOR_BASE_PATH = '/api/auth/2fa';

export const TWO_FACTOR_PATHS = {
  SETUP: `${TWO_FACTOR_BASE_PATH}/setup`,
  CONFIRM: `${TWO_FACTOR_BASE_PATH}/confirm`,
  DISABLE: `${TWO_FACTOR_BASE_PATH}/disable`,
  REGENERATE: `${TWO_FACTOR_BASE_PATH}/recovery-codes/regenerate`,
  VERIFY: `${TWO_FACTOR_BASE_PATH}/verify`,
} as const;
