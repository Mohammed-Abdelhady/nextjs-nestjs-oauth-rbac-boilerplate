import { ApiError, OAuthError } from '@app/sdk';
import { AUTHORITY_UNAVAILABLE_CODE, RATE_LIMIT_EXCEEDED_CODE } from './constants';
import { isDefinitiveRefreshFailure } from './failure';
import { makeRefreshRecord } from './refresh-helpers';
import { classifyDisposedCredentialRecord } from './credential-record-store';
import { DISPOSED_RECORD_OWNER } from './constants';
import type { AuthRuntime, CredentialRecordGuard } from './runtime';
import { revokeQuietly } from './revocation';
import type { ApiClient } from '@app/sdk';
import type { AbortSignalPort } from './types/auth';

export async function persistRotatedSessionAfterDispose(
  runtime: AuthRuntime,
  client: ApiClient<AbortSignalPort>,
  installDigest: string,
  sentRefreshToken: string,
  tokens: {
    accessToken: string;
    refreshToken: string;
    lineageId: string;
    proofKeyThumbprint?: string;
  },
): Promise<void> {
  const guard = refreshGuard(installDigest, sentRefreshToken, tokens.lineageId);
  const nextRecord = makeRefreshRecord(runtime, installDigest, tokens);
  const written = await runtime
    .replaceRecord(nextRecord, runtime.epoch, { kind: 'replace', record: nextRecord }, guard)
    .catch(() => false);
  if (written) return;
  await settleDisposedToken(
    runtime,
    client,
    installDigest,
    tokens.lineageId,
    tokens.refreshToken,
    sentRefreshToken,
  );
}

export async function settleDisposedToken(
  runtime: AuthRuntime,
  client: ApiClient<AbortSignalPort>,
  installDigest: string,
  lineageId: string | undefined,
  refreshToken: string,
  sentRefreshToken?: string,
  proofKeyThumbprint?: string,
): Promise<void> {
  const guard: CredentialRecordGuard = {
    kind: 'session',
    installDigest,
    refreshToken,
    ...(lineageId === undefined ? {} : { lineageId }),
    ...(sentRefreshToken === undefined ? {} : { sentRefreshToken }),
  };
  const owner = await classifyDisposedCredentialRecord(runtime, guard);
  if (owner === DISPOSED_RECORD_OWNER.OWN_OTHER) return;
  if (owner === DISPOSED_RECORD_OWNER.OWN_SAME) return;
  if (!runtime.markDisposedRevocationIntent(refreshToken)) return;
  await revokeQuietly(
    client,
    runtime.dependencies,
    refreshToken,
    runtime.config.clientId,
    proofKeyThumbprint === undefined
      ? undefined
      : {
          serverBaseAddress: runtime.config.serverBaseAddress,
          proofKeyThumbprint,
        },
  );
  if (owner === DISPOSED_RECORD_OWNER.UNREADABLE)
    await runtime.deleteRecordGuarded(runtime.epoch, guard).catch(() => false);
}

export async function settleDisposedRefreshFailure(
  runtime: AuthRuntime,
  stableRecord: ReturnType<typeof makeRefreshRecord>,
  error: unknown,
): Promise<void> {
  const installDigest = stableRecord.installDigest;
  const sentRefreshToken = stableRecord.tokens?.refreshToken;
  if (!sentRefreshToken) return;
  const guard = refreshGuard(installDigest, sentRefreshToken, stableRecord.lineageId);
  if (!runtime.oauthTokenRequestSent) {
    await runtime
      .replaceRecord(stableRecord, runtime.epoch, { kind: 'replace', record: stableRecord }, guard)
      .catch(() => false);
    return;
  }
  if (error instanceof OAuthError) {
    if (isDefinitiveRefreshFailure(error))
      await runtime.deleteRecordGuarded(runtime.epoch, guard).catch(() => false);
    return;
  }
  if (
    error instanceof ApiError &&
    error.status === 429 &&
    error.code === RATE_LIMIT_EXCEEDED_CODE
  ) {
    await runtime
      .replaceRecord(stableRecord, runtime.epoch, { kind: 'replace', record: stableRecord }, guard)
      .catch(() => false);
    return;
  }
  if (
    error instanceof ApiError &&
    error.status === 503 &&
    error.code === AUTHORITY_UNAVAILABLE_CODE
  ) {
    await runtime
      .replaceRecord(stableRecord, runtime.epoch, { kind: 'replace', record: stableRecord }, guard)
      .catch(() => false);
  }
}

function refreshGuard(
  installDigest: string,
  sentRefreshToken: string,
  lineageId?: string,
): CredentialRecordGuard {
  return {
    kind: 'refresh',
    installDigest,
    refreshToken: sentRefreshToken,
    ...(lineageId === undefined ? {} : { lineageId }),
  };
}
