import {
  AUTH_OPERATION,
  AUTH_REASON,
  CREDENTIAL_READ_TIMEOUT_MS,
  PORT_OPERATION,
  REVOKE_OUTCOME,
  SESSION_STATUS,
} from './constants';
import { withPortDeadline } from './deadlines';
import { parseStoredRecord, recordMatches } from './persistence';
import { revokeWithDeadline } from './revocation';
import type { AuthRuntime } from './runtime';
import type { CredentialRecordGuard } from './credential-record-store';
import type { ApiClient } from '@app/sdk';
import type { AbortSignalPort, SignOutOutcome } from './types/auth';
import type { RevokeResult } from './revocation';

export function createSignOutOperation(
  runtime: AuthRuntime,
  revocationClient: ApiClient<AbortSignalPort>,
) {
  return (): Promise<SignOutOutcome> => {
    if (runtime.disposed) return Promise.resolve({ kind: 'disposed' });
    if (runtime.signOutPromise) return runtime.signOutPromise;
    const recordWasLoaded = runtime.record !== undefined;
    const refreshToken = runtime.tokens?.refreshToken ?? runtime.record?.tokens?.refreshToken;
    const lineageId = runtime.tokens?.lineageId ?? runtime.record?.lineageId;
    if (refreshToken) runtime.markDisposedRevocationIntent(refreshToken);
    const epoch = runtime.bumpEpoch('signOut');
    runtime.deleteOwed = true;
    runtime.tokens = undefined;
    runtime.record = undefined;
    runtime.browserAbort?.abort();
    try {
      runtime.cancelAuthorizationDeadline?.();
    } catch {
      runtime.cancelAuthorizationDeadline = undefined;
    }
    runtime.cancelAuthorizationDeadline = undefined;
    const pending = runtime.raceWithDispose(
      Promise.resolve().then(() => finishSignOut(refreshToken, lineageId, recordWasLoaded, epoch)),
      () => ({ kind: 'disposed' as const }),
    );
    runtime.signOutPromise = pending;
    runtime.setState(SESSION_STATUS.SIGNED_OUT, AUTH_OPERATION.SIGNING_OUT);
    void pending.then(
      () => {
        if (runtime.signOutPromise === pending) runtime.signOutPromise = undefined;
      },
      () => {
        if (runtime.signOutPromise === pending) runtime.signOutPromise = undefined;
      },
    );
    return pending;
  };

  async function finishSignOut(
    refreshToken: string | undefined,
    lineageId: string | undefined,
    recordWasLoaded: boolean,
    epoch: number,
  ): Promise<SignOutOutcome> {
    let token = refreshToken;
    let disposeGuard: CredentialRecordGuard | undefined =
      token && runtime.installDigest
        ? {
            kind: 'session',
            installDigest: runtime.installDigest,
            refreshToken: token,
            ...(lineageId === undefined ? {} : { lineageId }),
          }
        : undefined;
    let readError: Error | undefined;
    if (token === undefined && !recordWasLoaded) {
      try {
        const stored = await withPortDeadline(
          runtime.dependencies.timer,
          CREDENTIAL_READ_TIMEOUT_MS,
          () => runtime.dependencies.credentials.read(),
          PORT_OPERATION.CREDENTIALS_READ,
        );
        if (stored.kind === 'found') {
          const record = parseStoredRecord(stored.value);
          if (record && recordMatches(record, runtime.config, record.installDigest)) {
            token = record.tokens?.refreshToken;
            if (token)
              disposeGuard = {
                kind: 'session',
                installDigest: record.installDigest,
                refreshToken: token,
                ...(record.lineageId === undefined ? {} : { lineageId: record.lineageId }),
              };
          }
          if (!record) readError = new Error('The saved auth record is unavailable');
        } else if (stored.kind !== 'missing') {
          readError = new Error('The saved auth record is unavailable');
        }
      } catch (error) {
        readError = asError(error);
      }
      if (!runtime.isEpochCurrent(epoch))
        return { kind: 'signedOut', revocation: 'recordUnavailable', error: readError };
    }
    const deletion = runtime
      .deleteRecordGuarded(epoch, disposeGuard)
      .then(() => undefined, asError);
    const revocation = token
      ? revokeWithDeadline(revocationClient, runtime.dependencies, token, runtime.config.clientId)
      : Promise.resolve<RevokeResult>({
          outcome: readError ? 'recordUnavailable' : REVOKE_OUTCOME.NOT_NEEDED,
          ...(readError === undefined ? {} : { error: readError }),
        });
    const [storageError, revokeResult] = await Promise.all([deletion, revocation]);
    if (refreshToken) {
      void runtime.writeTail.then(() => {
        if (!runtime.disposed) runtime.disposedRevocationIntents.delete(refreshToken);
      });
    }
    runtime.setState(
      SESSION_STATUS.SIGNED_OUT,
      AUTH_OPERATION.NONE,
      storageError ? { warning: 'storageBlocked', reason: AUTH_REASON.STORAGE_FAILURE } : {},
    );
    const error = revokeResult.error ?? storageError;
    return error === undefined
      ? { kind: 'signedOut', revocation: revokeResult.outcome }
      : { kind: 'signedOut', revocation: revokeResult.outcome, error };
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
