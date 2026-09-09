import { generateVerificationCode } from './verification-code.util';

describe('generateVerificationCode', () => {
  it('returns six digits', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateVerificationCode()).toMatch(/^\d{6}$/);
    }
  });

  it('stays inside the six-digit range', () => {
    for (let i = 0; i < 50; i += 1) {
      const value = Number(generateVerificationCode());
      expect(value).toBeGreaterThanOrEqual(100000);
      expect(value).toBeLessThanOrEqual(999999);
    }
  });
});
