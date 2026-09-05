import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Request, Response } from 'express';
import { hkdfSync } from 'crypto';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import {
  decodeSignedCookie,
  encodeSignedCookie,
} from '../utils/signed-cookie.util';
import {
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_CHALLENGE_HKDF_INFO,
  PASSKEY_CHALLENGE_KEY_BYTES,
  PASSKEY_CHALLENGE_TTL_MS,
} from '../constants/passkeys.constants';

/** Which ceremony a challenge was handed out for. */
export type PasskeyChallengePurpose = 'register' | 'login';

export interface PasskeyChallengePayload {
  purpose: PasskeyChallengePurpose;
  /** The base64url challenge the authenticator signs over. */
  challenge: string;
  /** Account the challenge was issued to. Registration only; login is open. */
  sub?: string;
  /** Epoch milliseconds after which the cookie is refused. */
  expiresAt: number;
}

/**
 * The five minutes between "give me options" and "here is the signed
 * response". The challenge itself is the whole state, so it rides in a signed
 * cookie rather than a collection.
 *
 * Registration and sign-in use one cookie name but carry a purpose, so a
 * challenge handed out for one ceremony is refused by the other.
 */
@Injectable()
export class PasskeyChallengeService {
  private readonly logger = new Logger(PasskeyChallengeService.name);

  constructor(private readonly configService: ConfigService) {}

  issue(
    response: Response,
    purpose: PasskeyChallengePurpose,
    challenge: string,
    userId?: string,
  ): void {
    const payload: PasskeyChallengePayload = {
      purpose,
      challenge,
      sub: userId,
      expiresAt: Date.now() + PASSKEY_CHALLENGE_TTL_MS,
    };

    response.cookie(
      PASSKEY_CHALLENGE_COOKIE,
      encodeSignedCookie(payload, this.key()),
      { ...this.cookieOptions(), maxAge: PASSKEY_CHALLENGE_TTL_MS },
    );
  }

  /**
   * @throws AppException PASSKEY_CHALLENGE_INVALID when the cookie is missing,
   * tampered with, expired, or was issued for the other ceremony
   */
  read(
    request: Request,
    purpose: PasskeyChallengePurpose,
  ): PasskeyChallengePayload {
    const cookies = request.cookies as Record<string, string> | undefined;
    const payload = decodeSignedCookie<PasskeyChallengePayload>(
      cookies?.[PASSKEY_CHALLENGE_COOKIE],
      this.key(),
    );

    if (!payload || typeof payload.challenge !== 'string') {
      throw this.invalid('missing or unreadable challenge cookie');
    }

    if (payload.purpose !== purpose) {
      throw this.invalid(`challenge was issued for ${payload.purpose}`);
    }

    if (
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Date.now()
    ) {
      throw this.invalid('challenge has expired');
    }

    return payload;
  }

  clear(response: Response): void {
    response.clearCookie(PASSKEY_CHALLENGE_COOKIE, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
    };
  }

  /**
   * Signed under a key derived from OAUTH_STATE_SECRET, the one secret every
   * deployment has to set. Deriving it under a passkey label keeps it from
   * standing in for the OAuth state key, or the other way round.
   *
   * @throws AppException PASSKEY_NOT_CONFIGURED when the secret is missing
   */
  private key(): Buffer {
    const secret = this.configService.get<string>('oauth.stateSecret');

    if (!secret) {
      throw new AppException(
        ErrorCode.PASSKEY_NOT_CONFIGURED,
        'Passkeys are not configured: OAUTH_STATE_SECRET is not set',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return Buffer.from(
      hkdfSync(
        'sha256',
        secret,
        Buffer.alloc(0),
        PASSKEY_CHALLENGE_HKDF_INFO,
        PASSKEY_CHALLENGE_KEY_BYTES,
      ),
    );
  }

  private invalid(reason: string): AppException {
    this.logger.warn(`Passkey challenge rejected: ${reason}`);
    return new AppException(
      ErrorCode.PASSKEY_CHALLENGE_INVALID,
      'This passkey attempt is no longer valid. Start again.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
