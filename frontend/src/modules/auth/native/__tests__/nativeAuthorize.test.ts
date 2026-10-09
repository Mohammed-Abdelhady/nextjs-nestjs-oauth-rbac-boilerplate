import { describe, expect, it } from 'vitest';
import { isSignInRequired } from '../../constants/nativeAuthorize';

describe('isSignInRequired', () => {
  it.each(['SESSION_REQUIRED', 'SESSION_INVALID', 'SESSION_EXPIRED'])(
    'is true for %s whatever status carried it',
    (code) => {
      expect(isSignInRequired(code)).toBe(true);
      expect(isSignInRequired(code, 403)).toBe(true);
    },
  );

  it('is true for any 401, including a code it does not know', () => {
    expect(isSignInRequired('SOMETHING_NEW', 401)).toBe(true);
    expect(isSignInRequired('INTERNAL_ERROR', 401)).toBe(true);
  });

  it.each([
    ['NATIVE_TRANSACTION_EXPIRED', 404],
    ['NATIVE_AUTHORIZE_ACCOUNT_MISMATCH', 409],
    ['FORBIDDEN', 403],
    ['INTERNAL_ERROR', 500],
    ['SESSION_LIMIT_REACHED', 403],
    ['', undefined],
  ])('is false for %s answered with %s', (code, status) => {
    expect(isSignInRequired(code, status)).toBe(false);
  });
});
