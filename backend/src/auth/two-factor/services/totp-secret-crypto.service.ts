import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'crypto';
import { TwoFactorSecret } from '../../../user/schemas/two-factor.schema';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { TWO_FACTOR_CHALLENGE_HKDF_INFO } from '../constants/two-factor.constants';

const KEY_BYTES = 32;
const IV_BYTES = 12;

/**
 * Encrypts TOTP secrets at rest with AES-256-GCM under TOTP_ENCRYPTION_KEY,
 * and derives the separate key the login challenge is signed with. One secret
 * in the environment, two keys that cannot stand in for each other.
 */
@Injectable()
export class TotpSecretCryptoService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plaintext: string): TwoFactorSecret {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    };
  }

  /**
   * @throws AppException TWO_FACTOR_NOT_CONFIGURED when the key is missing, or
   * when it no longer matches what the record was written with
   */
  decrypt(secret: TwoFactorSecret): string {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key(),
        Buffer.from(secret.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));

      return Buffer.concat([
        decipher.update(Buffer.from(secret.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      throw this.notConfigured(
        'the stored secret does not decrypt with the configured key',
      );
    }
  }

  /** Signing key for the login challenge, derived from the same environment key. */
  challengeKey(): Buffer {
    return Buffer.from(
      hkdfSync(
        'sha256',
        this.key(),
        Buffer.alloc(0),
        TWO_FACTOR_CHALLENGE_HKDF_INFO,
        KEY_BYTES,
      ),
    );
  }

  private key(): Buffer {
    const configured = this.configService.get<string>(
      'twoFactor.encryptionKey',
    );

    if (!configured) {
      throw this.notConfigured('TOTP_ENCRYPTION_KEY is not set');
    }

    const key = Buffer.from(configured, 'base64');
    if (key.length !== KEY_BYTES) {
      throw this.notConfigured(
        `TOTP_ENCRYPTION_KEY decodes to ${key.length} bytes, ${KEY_BYTES} expected`,
      );
    }

    return key;
  }

  private notConfigured(reason: string): AppException {
    return new AppException(
      ErrorCode.TWO_FACTOR_NOT_CONFIGURED,
      `Two-factor authentication is not configured: ${reason}`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
