import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CookieOptions, Request, Response } from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  TwoFactorChallenge,
  TwoFactorChallengeDocument,
} from '../schemas/two-factor-challenge.schema';
import { TotpSecretCryptoService } from './totp-secret-crypto.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  TWO_FACTOR_CHALLENGE_TTL_MS,
  TWO_FACTOR_MAX_CHALLENGE_ATTEMPTS,
} from '../constants/two-factor.constants';

interface ChallengePayload {
  /** User the half-finished login belongs to. */
  sub: string;
  /** Random value matching the stored record. */
  nonce: string;
  /** Epoch milliseconds after which the token is refused. */
  expiresAt: number;
}

export interface TwoFactorChallengeContext {
  challengeId: Types.ObjectId;
  userId: Types.ObjectId;
}

const NONCE_BYTES = 32;

/**
 * The half-finished login between a first factor and a TOTP code.
 *
 * The cookie value is `<base64url payload>.<base64url HMAC-SHA256>`, signed
 * with a key derived from TOTP_ENCRYPTION_KEY. The wrong-code count lives in a
 * short lived record rather than in the token, so a client that edits its own
 * cookie cannot reset it.
 */
@Injectable()
export class TwoFactorChallengeService {
  private readonly logger = new Logger(TwoFactorChallengeService.name);

  constructor(
    @InjectModel(TwoFactorChallenge.name)
    private readonly challengeModel: Model<TwoFactorChallengeDocument>,
    private readonly configService: ConfigService,
    private readonly cryptoService: TotpSecretCryptoService,
  ) {}

  /** Opens a challenge for a user who passed a first factor. */
  async issue(userId: Types.ObjectId, response: Response): Promise<void> {
    const nonce = randomBytes(NONCE_BYTES).toString('base64url');
    const expiresAt = Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS;

    await this.challengeModel.create({
      user: userId,
      nonceHash: hashNonce(nonce),
      attempts: 0,
      expiresAt: new Date(expiresAt),
    });

    const token = this.encode({ sub: userId.toString(), nonce, expiresAt });
    response.cookie(TWO_FACTOR_CHALLENGE_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: TWO_FACTOR_CHALLENGE_TTL_MS,
    });
  }

  /**
   * Reads the cookie and the record behind it.
   *
   * @throws AppException TWO_FACTOR_CHALLENGE_INVALID when the cookie is
   * missing, tampered with, expired, already spent, or out of attempts
   */
  async read(request: Request): Promise<TwoFactorChallengeContext> {
    const payload = this.decodeCookie(request);
    const challenge = await this.challengeModel.findOne({
      nonceHash: hashNonce(payload.nonce),
      user: new Types.ObjectId(payload.sub),
    });

    if (!challenge) {
      throw this.invalid('challenge is unknown or already spent');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      await this.challengeModel.deleteOne({ _id: challenge._id });
      throw this.invalid('challenge has expired');
    }

    if (challenge.attempts >= TWO_FACTOR_MAX_CHALLENGE_ATTEMPTS) {
      await this.challengeModel.deleteOne({ _id: challenge._id });
      throw this.invalid('too many wrong codes');
    }

    return { challengeId: challenge._id, userId: challenge.user };
  }

  /**
   * Counts one wrong code. The challenge is dropped once the count reaches the
   * cap, which forces the user back through the first factor.
   */
  async registerFailure(challengeId: Types.ObjectId): Promise<void> {
    const challenge = await this.challengeModel.findOneAndUpdate(
      { _id: challengeId },
      { $inc: { attempts: 1 } },
      { new: true },
    );

    if (challenge && challenge.attempts >= TWO_FACTOR_MAX_CHALLENGE_ATTEMPTS) {
      await this.challengeModel.deleteOne({ _id: challengeId });
      this.logger.warn('Two-factor challenge discarded after too many tries');
    }
  }

  async consume(challengeId: Types.ObjectId): Promise<void> {
    await this.challengeModel.deleteOne({ _id: challengeId });
  }

  clear(response: Response): void {
    response.clearCookie(TWO_FACTOR_CHALLENGE_COOKIE, this.cookieOptions());
  }

  private decodeCookie(request: Request): ChallengePayload {
    const cookies = request.cookies as Record<string, string> | undefined;
    const raw = cookies?.[TWO_FACTOR_CHALLENGE_COOKIE];

    if (typeof raw !== 'string' || raw.length === 0) {
      throw this.invalid('missing challenge cookie');
    }

    const separator = raw.lastIndexOf('.');
    if (separator <= 0) {
      throw this.invalid('malformed challenge cookie');
    }

    const encoded = raw.slice(0, separator);
    if (!constantTimeEquals(raw.slice(separator + 1), this.sign(encoded))) {
      throw this.invalid('challenge cookie signature mismatch');
    }

    const payload = this.decode(encoded);
    if (payload.expiresAt <= Date.now()) {
      throw this.invalid('challenge cookie expired');
    }

    return payload;
  }

  private encode(payload: ChallengePayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.sign(encoded)}`;
  }

  private decode(encoded: string): ChallengePayload {
    try {
      const json = Buffer.from(encoded, 'base64url').toString('utf8');
      const payload = JSON.parse(json) as ChallengePayload;
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.nonce !== 'string' ||
        typeof payload.expiresAt !== 'number' ||
        !Types.ObjectId.isValid(payload.sub)
      ) {
        throw new Error('missing fields');
      }
      return payload;
    } catch {
      throw this.invalid('unreadable challenge cookie');
    }
  }

  private sign(encodedPayload: string): string {
    return createHmac('sha256', this.cryptoService.challengeKey())
      .update(encodedPayload)
      .digest('base64url');
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

  private invalid(reason: string): AppException {
    this.logger.warn(`Two-factor challenge rejected: ${reason}`);
    return new AppException(
      ErrorCode.TWO_FACTOR_CHALLENGE_INVALID,
      'This sign-in attempt is no longer valid. Start again.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

function hashNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex');
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  return timingSafeEqual(leftBytes, rightBytes);
}
