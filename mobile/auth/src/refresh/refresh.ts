import { OAuthError } from '@app/sdk';
import type { ApiClient } from '@app/sdk';
import { AUTH_OPERATION, AUTH_REASON, SESSION_STATUS } from '../constants';
import {
  AuthSessionError,
  authPortFailure,
  DeviceBindingRequiredError,
  DeviceKeyAuthError,
} from '../errors/errors';
import {
  isDefinitiveRefreshFailure,
  isDeviceBindingRequired,
  oauthFailureReason,
} from '../errors/failure';
import {
  isKnownNonRotatingFailure,
  makeRefreshRecord,
  normalizeRefreshError,
  safeThrottleDeadline,
} from './refresh-helpers';
import { revokeQuietly } from '../sign-out/revocation';
import { requestRefreshTokens } from './refresh-token-request';
import { settleDeviceKeyRefreshFailure } from './refresh-key-failure';
import { createRefreshSingleFlight } from './refresh-single-flight';
import { finishRefresh, installRotatedTokens } from './refresh-state';
import {
  persistRotatedSessionAfterDispose,
  settleDisposedRefreshFailure,
  settleDisposedToken,
} from './refresh-dispose';
import type { AuthRuntime } from '../runtime/runtime';
import type { AbortSignalPort } from '../types/auth';
import type { RuntimeTokens, SessionAuthRecord } from '../types/record';

export interface RefreshCoordinator {
  refresh(signal?: AbortSignalPort): Promise<RuntimeTokens>;
  ensureCurrentTokens(signal?: AbortSignalPort): Promise<RuntimeTokens>;
}

export function createRefreshCoordinator(
  runtime: AuthRuntime,
  client: ApiClient<AbortSignalPort>,
  revocationClient: ApiClient<AbortSignalPort> = client,
): RefreshCoordinator {
  const refresh = createRefreshSingleFlight(runtime, performRefresh);

  async function performRefresh(
    epoch: number,
    currentTokens: RuntimeTokens,
  ): Promise<RuntimeTokens> {
    let disposedFailureSettled = false;
    let settledToken: string | undefined;
    let tokenSettlement: Promise<void> | undefined;
    const installDigest = runtime.installDigest;
    if (
      !installDigest ||
      !runtime.isEpochCurrent(epoch) ||
      runtime.snapshot.status !== SESSION_STATUS.SIGNED_IN ||
      runtime.tokens !== currentTokens
    )
      throw new AuthSessionError();
    const stableRecord = makeRefreshRecord(runtime, installDigest, currentTokens);
    const markerRecord = makeRefreshRecord(runtime, installDigest, currentTokens, true);
    runtime.setState(SESSION_STATUS.SIGNED_IN, AUTH_OPERATION.REFRESHING, {
      profile: runtime.snapshot.profile,
      warning: runtime.snapshot.warning,
    });
    try {
      const written = await runtime.replaceRecord(markerRecord, epoch, {
        kind: 'replace',
        record: stableRecord,
      });
      if (!written) throw new AuthSessionError();
    } catch (error) {
      if (!runtime.isEpochCurrent(epoch)) throw new AuthSessionError();
      finishRefresh(runtime, true, error);
      throw authPortFailure(error, 'credentials.replace');
    }
    if (
      !runtime.isEpochCurrent(epoch) ||
      runtime.snapshot.status !== SESSION_STATUS.SIGNED_IN ||
      runtime.tokens !== currentTokens
    )
      throw new AuthSessionError();

    try {
      runtime.lastOAuthTokenSentAt = undefined;
      runtime.oauthTokenRequestSent = false;
      const settleLateRotation = (refreshToken: string): Promise<void> => {
        if (settledToken === refreshToken && tokenSettlement) return tokenSettlement;
        settledToken = refreshToken;
        tokenSettlement = runtime.disposed
          ? settleDisposedToken(
              runtime,
              revocationClient,
              installDigest,
              currentTokens.lineageId,
              refreshToken,
              currentTokens.refreshToken,
              currentTokens.proofKeyThumbprint,
            )
          : revokeQuietly(
              revocationClient,
              runtime.dependencies,
              refreshToken,
              runtime.config.clientId,
              currentTokens.proofKeyThumbprint === undefined
                ? undefined
                : {
                    serverBaseAddress: runtime.config.serverBaseAddress,
                    proofKeyThumbprint: currentTokens.proofKeyThumbprint,
                  },
            );
        return tokenSettlement;
      };
      const tokens = await requestRefreshTokens(
        runtime,
        client,
        currentTokens,
        epoch,
        (lateTokens) => {
          void settleLateRotation(lateTokens.refreshToken).catch(() => undefined);
        },
      );
      const rotatedTokens = {
        ...tokens,
        lineageId: currentTokens.lineageId,
        ...(currentTokens.proofKeyThumbprint === undefined
          ? {}
          : { proofKeyThumbprint: currentTokens.proofKeyThumbprint }),
      };
      if (!runtime.isEpochCurrent(epoch)) {
        if (runtime.disposed && runtime.preserveSessionOnDispose) {
          await persistRotatedSessionAfterDispose(
            runtime,
            revocationClient,
            installDigest,
            currentTokens.refreshToken,
            rotatedTokens,
          );
          disposedFailureSettled = true;
          throw new AuthSessionError();
        }
        await settleLateRotation(tokens.refreshToken);
        throw new AuthSessionError();
      }
      const sentAt = runtime.lastOAuthTokenSentAt ?? runtime.monotonicTime();
      const nextRecord = makeRefreshRecord(runtime, installDigest, rotatedTokens);
      try {
        const written = await runtime.replaceRecord(
          nextRecord,
          epoch,
          { kind: 'replace', record: nextRecord },
          {
            kind: 'session',
            installDigest,
            refreshToken: tokens.refreshToken,
            lineageId: currentTokens.lineageId,
          },
        );
        if (!written) {
          if (
            !runtime.isEpochCurrent(epoch) &&
            runtime.disposed &&
            runtime.preserveSessionOnDispose
          ) {
            await persistRotatedSessionAfterDispose(
              runtime,
              revocationClient,
              installDigest,
              currentTokens.refreshToken,
              rotatedTokens,
            );
            disposedFailureSettled = true;
          }
          throw new AuthSessionError();
        }
      } catch (failure) {
        if (!runtime.isEpochCurrent(epoch)) {
          if (runtime.disposed && runtime.preserveSessionOnDispose) {
            if (!disposedFailureSettled) {
              await persistRotatedSessionAfterDispose(
                runtime,
                revocationClient,
                installDigest,
                currentTokens.refreshToken,
                rotatedTokens,
              );
              disposedFailureSettled = true;
            }
            throw new AuthSessionError();
          }
          await settleLateRotation(tokens.refreshToken);
          throw new AuthSessionError();
        }
        const memoryTokens = installRotatedTokens(runtime, tokens, sentAt, currentTokens);
        finishRefresh(runtime, true, failure);
        return memoryTokens;
      }
      const nextTokens = installRotatedTokens(runtime, tokens, sentAt, currentTokens);
      finishRefresh(runtime);
      return nextTokens;
    } catch (error) {
      if (!runtime.isEpochCurrent(epoch)) {
        if (runtime.disposed && runtime.preserveSessionOnDispose && !disposedFailureSettled) {
          await settleDisposedRefreshFailure(runtime, stableRecord, error);
          disposedFailureSettled = true;
        }
        throw error;
      }
      if (error instanceof DeviceKeyAuthError) {
        await settleDeviceKeyRefreshFailure(runtime, stableRecord, epoch, error);
        throw error;
      }
      if (error instanceof OAuthError) {
        const endedEpoch = runtime.bumpEpoch();
        // Keep unknown rotations out of memory if a stale status is ever restored.
        runtime.tokens = undefined;
        if (isDeviceBindingRequired(error)) {
          runtime.setState(SESSION_STATUS.REAUTH_REQUIRED, AUTH_OPERATION.NONE, {
            reason: AUTH_REASON.DEVICE_BINDING_REQUIRED,
          });
          throw new DeviceBindingRequiredError(error.errorDescription ?? 'NATIVE_DPOP_REQUIRED');
        }
        if (!isDefinitiveRefreshFailure(error)) {
          runtime.setState(SESSION_STATUS.REAUTH_REQUIRED, AUTH_OPERATION.NONE, {
            reason: AUTH_REASON.REFRESH_INTERRUPTED,
          });
          throw error;
        }
        try {
          await runtime.deleteRecord(endedEpoch);
        } catch {
          if (!runtime.isEpochCurrent(endedEpoch)) throw error;
          runtime.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
            reason: AUTH_REASON.STORAGE_FAILURE,
          });
          throw error;
        }
        if (!runtime.isEpochCurrent(endedEpoch)) throw error;
        runtime.setState(SESSION_STATUS.SIGNED_OUT, AUTH_OPERATION.NONE, {
          reason: oauthFailureReason(error),
        });
        throw error;
      }
      if (isKnownNonRotatingFailure(error)) {
        runtime.refreshThrottleUntil = safeThrottleDeadline(runtime);
        await clearMarkerAfterThrottle(stableRecord, epoch, error);
        throw error;
      }
      if (!runtime.oauthTokenRequestSent) {
        await clearMarkerAfterThrottle(stableRecord, epoch, error);
        throw authPortFailure(error, 'timer.after');
      }
      runtime.bumpEpoch();
      runtime.tokens = undefined;
      runtime.setState(SESSION_STATUS.REAUTH_REQUIRED, AUTH_OPERATION.NONE, {
        reason: AUTH_REASON.REFRESH_INTERRUPTED,
      });
      throw normalizeRefreshError(error);
    }
  }

  async function clearMarkerAfterThrottle(
    record: SessionAuthRecord,
    epoch: number,
    failure: unknown,
  ): Promise<void> {
    try {
      const written = await runtime.replaceRecord(record, epoch);
      if (!written) throw new AuthSessionError();
      if (!runtime.isEpochCurrent(epoch)) return;
      finishRefresh(runtime);
    } catch (refused) {
      if (!runtime.isEpochCurrent(epoch)) {
        if (runtime.disposed) await settleDisposedRefreshFailure(runtime, record, failure);
        return;
      }
      finishRefresh(runtime, true, refused);
    }
  }

  const ensureCurrentTokens = async (signal?: AbortSignalPort): Promise<RuntimeTokens> => {
    const token = runtime.tokens;
    if (
      !token ||
      (runtime.snapshot.status !== SESSION_STATUS.SIGNED_IN &&
        runtime.snapshot.operation !== AUTH_OPERATION.EXCHANGING)
    ) {
      throw new AuthSessionError();
    }
    if (token.expiresAt <= runtime.monotonicTime()) return refresh(signal);
    return token;
  };

  return { refresh, ensureCurrentTokens };
}
