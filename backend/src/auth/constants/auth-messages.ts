/**
 * Reply used by register, resend activation and forgot password.
 * All three answer the same way whether or not the address belongs to an
 * account, so none of them can be used to find out who has one.
 */
export const GENERIC_CODE_SENT_MESSAGE =
  'If an account exists, a code has been sent';
