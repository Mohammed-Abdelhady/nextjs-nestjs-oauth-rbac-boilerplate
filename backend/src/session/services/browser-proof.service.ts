import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { CookieOptions, Request, Response } from 'express';
import { Model } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { Clock } from '../../common/services/clock';
import {
  BROWSER_PROOF_TTL_MS,
  browserProofCookieName,
} from '../constants/browser-proof';
import {
  BrowserProof,
  BrowserProofDocument,
} from '../schemas/browser-proof.schema';
import { hashEquals, hashToken, randomSecret } from '../utils/token-hash';

@Injectable()
export class BrowserProofService {
  constructor(
    @InjectModel(BrowserProof.name)
    private readonly proofModel: Model<BrowserProofDocument>,
    private readonly configService: ConfigService,
    private readonly clock: Clock,
  ) {}

  async issue(response: Response): Promise<string> {
    const proofId = randomSecret();
    const token = randomSecret();
    const now = this.clock.now();
    await this.proofModel.create({
      proofIdHash: hashToken(proofId),
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + BROWSER_PROOF_TTL_MS),
      spent: false,
    });
    response.cookie(this.cookieName(), proofId, this.cookieOptions());
    return token;
  }

  async consume(request: Request, presented: string): Promise<void> {
    const proofId = this.readCookie(request);
    if (!proofId) {
      throw new AppException(
        ErrorCode.CSRF_REQUIRED,
        'Browser proof is required',
        HttpStatus.FORBIDDEN,
      );
    }

    const now = this.clock.now();
    const proof = await this.proofModel
      .findOne({
        proofIdHash: hashToken(proofId),
        spent: false,
        expiresAt: { $gt: now },
      })
      .exec();
    if (!proof || !hashEquals(presented, proof.tokenHash)) {
      throw new AppException(
        ErrorCode.CSRF_INVALID,
        'Browser proof is invalid',
        HttpStatus.FORBIDDEN,
      );
    }

    const consumed = await this.proofModel
      .updateOne({ _id: proof._id, spent: false }, { $set: { spent: true } })
      .exec();
    if (consumed.modifiedCount !== 1) {
      throw new AppException(
        ErrorCode.CSRF_INVALID,
        'Browser proof is invalid',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private cookieName(): string {
    return browserProofCookieName(this.configService.get<string>('NODE_ENV'));
  }

  private cookieOptions(): CookieOptions {
    const production =
      this.configService.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: production,
      sameSite: 'strict',
      path: '/',
      maxAge: BROWSER_PROOF_TTL_MS,
    };
  }

  private readCookie(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    const value = cookies?.[this.cookieName()];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    return undefined;
  }
}
