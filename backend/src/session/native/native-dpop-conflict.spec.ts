import { isNativeDpopProofIdConflict } from './native-dpop.service';

describe('native DPoP replay error classification', () => {
  it('recognizes the proof id unique-index conflict by code and key pattern', () => {
    expect(
      isNativeDpopProofIdConflict({
        code: 11000,
        keyPattern: { proofIdHash: 1 },
      }),
    ).toBe(true);
  });

  it.each([
    [
      'a different duplicate key',
      { code: 11000, keyPattern: { tokenHash: 1 } },
    ],
    [
      'a different database error code',
      { code: 11001, keyPattern: { proofIdHash: 1 } },
    ],
    ['only a duplicate-key message', { message: 'E11000 duplicate key' }],
  ])('does not classify %s as a proof id replay', (_label, error) => {
    expect(isNativeDpopProofIdConflict(error)).toBe(false);
  });
});
