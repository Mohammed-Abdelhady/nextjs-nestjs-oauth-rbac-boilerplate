import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import {
  NATIVE_DPOP_FAILURE_REASON,
  NATIVE_DPOP_PROOF_ID_TTL_MS,
  NATIVE_DPOP_SECRET_MIN_LENGTH,
  NATIVE_DPOP_TOKEN_PATH,
} from '../constants/session-policy';
import {
  NativeDpopProofId,
  NativeDpopProofIdDocument,
} from '../schemas/native-dpop-proof-id.schema';
import { hashToken } from '../utils/token-hash';
import {
  NativeDpopProofResult,
  verifyNativeDpopProof,
} from './native-dpop-proof';
import {
  nativeDpopNonceCandidates,
  createNativeDpopNonce,
} from './native-dpop-nonce';

export interface NativeDpopExchangeVerification {
  result: NativeDpopProofResult;
  challengeNonce?: string;
}

@Injectable()
export class NativeDpopService {
  constructor(
    @InjectModel(NativeDpopProofId.name)
    private readonly proofIds: Model<NativeDpopProofIdDocument>,
    private readonly config: ConfigService,
  ) {}

  verifyExchangeProof(
    proof: string,
    now: Date,
  ): NativeDpopExchangeVerification {
    const secret = requireNativeDpopNonceSecret(
      this.config.get<unknown>('auth.nativeDpopNonceSecret'),
    );
    const apiOrigin = this.config.get<string>('server.apiUrl');
    if (!apiOrigin) {
      throw new AppException(
        ErrorCode.NATIVE_DPOP_CONFIGURATION_INVALID,
        'Native DPoP configuration is invalid',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const expectedAddress = resolveNativeDpopTokenAddress(apiOrigin);
    if (!expectedAddress) {
      throw new AppException(
        ErrorCode.NATIVE_DPOP_CONFIGURATION_INVALID,
        'Native DPoP configuration is invalid',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const expectedNonces = nativeDpopNonceCandidates(secret, now);
    const result = verifyNativeDpopProof({
      proof,
      expectedMethod: 'POST',
      expectedAddress,
      now,
      expectedNonces,
    });
    const challengeNonce =
      !result.ok &&
      (result.reason === NATIVE_DPOP_FAILURE_REASON.NONCE_REQUIRED ||
        result.reason === NATIVE_DPOP_FAILURE_REASON.NONCE_INVALID)
        ? createNativeDpopNonce(secret, now)
        : undefined;
    return { result, challengeNonce };
  }

  async reserveProofId(
    session: ClientSession,
    jti: string,
    now: Date,
  ): Promise<void> {
    await this.proofIds.create(
      [
        {
          proofIdHash: hashToken(jti),
          expiresAt: new Date(now.getTime() + NATIVE_DPOP_PROOF_ID_TTL_MS),
        },
      ],
      { session },
    );
  }
}

export function requireNativeDpopNonceSecret(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length < NATIVE_DPOP_SECRET_MIN_LENGTH
  ) {
    throw new AppException(
      ErrorCode.NATIVE_DPOP_CONFIGURATION_INVALID,
      'Native DPoP configuration is invalid',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
  return value;
}

export function resolveNativeDpopTokenAddress(
  apiOrigin: string,
): string | undefined {
  try {
    const apiUrl = new URL(apiOrigin);
    if (
      !['http:', 'https:'].includes(apiUrl.protocol) ||
      !apiUrl.hostname ||
      apiUrl.username ||
      apiUrl.password
    ) {
      return undefined;
    }
    const pathPrefix = apiUrl.pathname.replace(/\/+$/, '');
    apiUrl.pathname = `${pathPrefix}${NATIVE_DPOP_TOKEN_PATH}`;
    apiUrl.search = '';
    apiUrl.hash = '';
    return apiUrl.toString();
  } catch {
    return undefined;
  }
}

export function isNativeDpopProofIdConflict(error: unknown): boolean {
  if (!isRecord(error) || error.code !== 11000 || !isRecord(error.keyPattern)) {
    return false;
  }
  return (
    error.keyPattern.proofIdHash === 1 &&
    Object.keys(error.keyPattern).length === 1
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
