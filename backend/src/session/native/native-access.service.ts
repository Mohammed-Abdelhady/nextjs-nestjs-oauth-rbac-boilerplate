import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { Clock } from '../../common/services/clock';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { CREDENTIAL_PURPOSE } from '../constants/credential-purpose';
import {
  NativeCredential,
  NativeCredentialDocument,
} from '../schemas/native-credential.schema';
import { LeanSession } from '../schemas/session.schema';
import { linearizable } from '../utils/linearizable-query';
import { hashToken } from '../utils/token-hash';
import { SessionAuthorityService } from '../services/session-authority.service';

const BEARER_MAX_LENGTH = 256;

export function readBearerToken(request: Request): string | null {
  const header = request.headers?.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const separator = header.indexOf(' ');
  if (separator <= 0) {
    return null;
  }
  const scheme = header.slice(0, separator);
  const token = header.slice(separator + 1).trim();
  if (
    scheme !== 'Bearer' ||
    token.length === 0 ||
    token.length > BEARER_MAX_LENGTH
  ) {
    return null;
  }
  return token;
}

@Injectable()
export class NativeAccessService {
  constructor(
    @InjectModel(NativeCredential.name)
    private readonly credentials: Model<NativeCredentialDocument>,
    private readonly authority: SessionAuthorityService,
    private readonly clock: Clock,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async validate(rawToken: string): Promise<LeanSession | null> {
    if (!this.authEpoch.nativeEnabled()) {
      throw new AppException(
        ErrorCode.NATIVE_AUTH_DISABLED,
        'Native authentication is disabled',
        HttpStatus.FORBIDDEN,
      );
    }
    const credential = await linearizable(
      this.credentials.findOne({
        tokenHash: hashToken(rawToken),
        purpose: CREDENTIAL_PURPOSE.NATIVE_ACCESS,
        spent: false,
        revokedAt: { $exists: false },
        expiresAt: { $gt: this.clock.now() },
      }),
    ).exec();
    if (!credential) {
      return null;
    }
    return this.authority.validateById(credential.sessionId, true);
  }
}
