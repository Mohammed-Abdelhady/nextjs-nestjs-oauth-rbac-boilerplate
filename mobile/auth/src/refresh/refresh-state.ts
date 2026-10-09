import { AUTH_OPERATION, AUTH_REASON, SESSION_STATUS } from '../constants';
import { isStoreLocked } from '../storage/credential-write';
import type { AuthRuntime } from '../runtime/runtime';
import type { RuntimeTokens } from '../types/record';

/** With a warning, `failure` is the refused save: a locked store is asked again on restore. */
export function finishRefresh(runtime: AuthRuntime, warning = false, failure?: unknown): void {
  runtime.setState(SESSION_STATUS.SIGNED_IN, AUTH_OPERATION.NONE, {
    profile: runtime.snapshot.profile,
    ...(warning ? { warning: 'storageBlocked' as const } : {}),
    ...(warning && isStoreLocked(failure) ? { reason: AUTH_REASON.STORAGE_LOCKED } : {}),
  });
}

export function installRotatedTokens(
  runtime: AuthRuntime,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  sentAt: number,
  previous: RuntimeTokens,
): RuntimeTokens {
  return runtime.installTokens(
    tokens.accessToken,
    tokens.refreshToken,
    sentAt,
    tokens.expiresIn,
    previous.lineageId,
    previous.proofKeyThumbprint,
  );
}
