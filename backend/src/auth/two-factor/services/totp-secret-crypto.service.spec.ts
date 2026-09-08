import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TotpSecretCryptoService } from './totp-secret-crypto.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';

const KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');

function service(encryptionKey?: string): TotpSecretCryptoService {
  return new TotpSecretCryptoService({
    get: <T>(key: string): T | undefined =>
      key === 'twoFactor.encryptionKey'
        ? (encryptionKey as T | undefined)
        : undefined,
  } as unknown as ConfigService);
}

function expectNotConfigured(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    const exception = error as AppException;
    expect(exception).toBeInstanceOf(AppException);
    expect(exception.getCode()).toBe(ErrorCode.TWO_FACTOR_NOT_CONFIGURED);
    expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    return;
  }
  throw new Error('expected the call to throw');
}

describe('TotpSecretCryptoService', () => {
  it('should read back what it encrypted', () => {
    const crypto = service(KEY);

    const stored = crypto.encrypt('JBSWY3DPEHPK3PXP');

    expect(stored.ciphertext).toEqual(expect.any(String));
    expect(Buffer.from(stored.iv, 'base64')).toHaveLength(12);
    expect(crypto.decrypt(stored)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('should give two encryptions of the same secret different ciphertexts', () => {
    const crypto = service(KEY);

    const first = crypto.encrypt('JBSWY3DPEHPK3PXP');
    const second = crypto.encrypt('JBSWY3DPEHPK3PXP');

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('should refuse a record whose tag was changed', () => {
    const crypto = service(KEY);
    const stored = crypto.encrypt('JBSWY3DPEHPK3PXP');

    expectNotConfigured(() =>
      crypto.decrypt({
        ...stored,
        tag: Buffer.alloc(16, 1).toString('base64'),
      }),
    );
  });

  it('should refuse a record written under a different key', () => {
    const stored = service(KEY).encrypt('JBSWY3DPEHPK3PXP');

    expectNotConfigured(() => service(OTHER_KEY).decrypt(stored));
  });

  it('should report a missing key instead of encrypting', () => {
    expectNotConfigured(() => service().encrypt('JBSWY3DPEHPK3PXP'));
  });

  it('should report a key that is not 32 bytes', () => {
    expectNotConfigured(() =>
      service(Buffer.alloc(16, 7).toString('base64')).encrypt('secret'),
    );
  });

  it('should derive a challenge key that is neither the encryption key nor random', () => {
    const first = service(KEY).challengeKey();
    const second = service(KEY).challengeKey();

    expect(first).toHaveLength(32);
    expect(first.equals(second)).toBe(true);
    expect(first.equals(Buffer.from(KEY, 'base64'))).toBe(false);
    expect(first.equals(service(OTHER_KEY).challengeKey())).toBe(false);
  });
});
