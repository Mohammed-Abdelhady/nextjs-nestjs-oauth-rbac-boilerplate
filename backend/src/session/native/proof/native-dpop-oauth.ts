import { HttpStatus } from '@nestjs/common';
import {
  OauthFailure,
  OAUTH_ERROR,
  oauthFailure,
} from '../oauth/native-oauth.types';
import type { NativeDpopProofResult } from './native-dpop-proof';

export function nativeDpopOauthFailure(
  result: Extract<NativeDpopProofResult, { ok: false }>,
  challengeNonce?: string,
): OauthFailure {
  const failure = oauthFailure(
    HttpStatus.BAD_REQUEST,
    challengeNonce
      ? OAUTH_ERROR.USE_DPOP_NONCE
      : OAUTH_ERROR.INVALID_DPOP_PROOF,
    result.reason,
  );
  return challengeNonce ? { ...failure, dpopNonce: challengeNonce } : failure;
}
