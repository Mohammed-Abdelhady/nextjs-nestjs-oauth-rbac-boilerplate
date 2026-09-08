import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  recoveryHashEquals,
} from './recovery-code.util';
import {
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_LENGTH,
} from '../constants/two-factor.constants';

describe('recovery codes', () => {
  it('should generate ten distinct base32 codes', () => {
    const codes = generateRecoveryCodes();

    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    codes.forEach((code) => {
      expect(code).toMatch(new RegExp(`^[A-Z2-7]{${RECOVERY_CODE_LENGTH}}$`));
    });
  });

  it('should not repeat a batch', () => {
    expect(generateRecoveryCodes()).not.toEqual(generateRecoveryCodes());
  });

  it('should hash to a sha256 digest that hides the code', () => {
    const hash = hashRecoveryCode('K3M7QRTVWX');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('K3M7QRTVWX');
  });

  it('should hash a retyped code to the same digest', () => {
    expect(hashRecoveryCode('k3m7q-rtvwx')).toBe(
      hashRecoveryCode('K3M7QRTVWX'),
    );
    expect(hashRecoveryCode(' K3M7 QRTVWX ')).toBe(
      hashRecoveryCode('K3M7QRTVWX'),
    );
  });

  it('should strip spacing and case when normalising', () => {
    expect(normalizeRecoveryCode(' k3m7-qrtvwx ')).toBe('K3M7QRTVWX');
  });

  it('should compare digests without accepting a near miss', () => {
    const hash = hashRecoveryCode('K3M7QRTVWX');

    expect(recoveryHashEquals(hash, hash)).toBe(true);
    expect(recoveryHashEquals(hash, hashRecoveryCode('AAAAAAAAAA'))).toBe(
      false,
    );
    expect(recoveryHashEquals(hash, hash.slice(0, 62))).toBe(false);
    expect(recoveryHashEquals('', '')).toBe(false);
  });
});
