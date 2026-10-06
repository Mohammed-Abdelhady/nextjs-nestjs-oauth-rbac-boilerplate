import { AUTH_OPERATION, AUTH_REASON, SESSION_STATUS } from './constants';
import {
  CALLBACK_READ_TIMEOUT_MS,
  CREDENTIAL_READ_TIMEOUT_MS,
  CRYPTO_DIGEST_TIMEOUT_MS,
  INSTALL_IDENTITY_TIMEOUT_MS,
  PORT_OPERATION,
} from './constants';
import { withPortDeadline } from './deadlines';
import {
  digestInstallIdentity,
  parseStoredRecord,
  recordMatches,
  transactionExpired,
} from './persistence';
import type { AuthRuntime } from './runtime';
import type { RestoreOutcome } from './types/auth';
import type { SignInController } from './sign-in';

export function createRestoreOperation(runtime: AuthRuntime, signIn: SignInController) {
  const restore = (): Promise<RestoreOutcome> => {
    if (runtime.disposed) return Promise.resolve({ kind: 'disposed' });
    if (runtime.restorePromise) return runtime.restorePromise;
    if (runtime.snapshot.status === SESSION_STATUS.SIGNED_IN && runtime.tokens) {
      return Promise.resolve({ kind: 'restored', status: SESSION_STATUS.SIGNED_IN });
    }
    if (runtime.snapshot.operation !== AUTH_OPERATION.NONE) {
      return Promise.resolve({ kind: 'restored', status: runtime.snapshot.status });
    }
    if (runtime.deleteOwed) return retryOwedDeletion();
    const profile = runtime.snapshot.profile;
    const epoch = runtime.bumpEpoch('restore');
    const pending = runtime.raceWithDispose(
      Promise.resolve().then(() => performRestore(epoch)),
      () => ({ kind: 'disposed' as const }),
    );
    runtime.restorePromise = pending;
    runtime.setState(
      SESSION_STATUS.RESTORING,
      AUTH_OPERATION.NONE,
      profile === undefined ? {} : { profile },
    );
    void pending.then(
      () => {
        if (runtime.restorePromise === pending) runtime.restorePromise = undefined;
      },
      () => {
        if (runtime.restorePromise === pending) runtime.restorePromise = undefined;
      },
    );
    return pending;
  };

  function retryOwedDeletion(): Promise<RestoreOutcome> {
    const epoch = runtime.bumpEpoch('restore');
    const pending = runtime.raceWithDispose(retryDeleteThenRestore(epoch), () => ({
      kind: 'disposed' as const,
    }));
    runtime.restorePromise = pending;
    runtime.setState(SESSION_STATUS.RESTORING, AUTH_OPERATION.NONE);
    void pending.then(
      () => {
        if (runtime.restorePromise === pending) runtime.restorePromise = undefined;
      },
      () => {
        if (runtime.restorePromise === pending) runtime.restorePromise = undefined;
      },
    );
    return pending;
  }

  async function retryDeleteThenRestore(epoch: number): Promise<RestoreOutcome> {
    try {
      const deleted = await runtime.deleteRecord(epoch);
      if (!runtime.isEpochCurrent(epoch))
        return { kind: 'restored', status: runtime.snapshot.status };
      if (!deleted) throw new Error('Credential deletion did not complete');
      return performRestore(epoch);
    } catch {
      if (runtime.isEpochCurrent(epoch))
        runtime.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
          reason: AUTH_REASON.STORAGE_FAILURE,
        });
      return { kind: 'storageBlocked', reason: 'unavailable' };
    }
  }

  async function performRestore(epoch: number): Promise<RestoreOutcome> {
    if (!runtime.isEpochCurrent(epoch))
      return { kind: 'restored', status: runtime.snapshot.status };
    let identity;
    try {
      identity = await withPortDeadline(
        runtime.dependencies.timer,
        INSTALL_IDENTITY_TIMEOUT_MS,
        () => runtime.dependencies.install.identity(),
        PORT_OPERATION.INSTALL_IDENTITY,
      );
    } catch {
      identity = { kind: 'unavailable' as const };
    }
    if (!runtime.isEpochCurrent(epoch))
      return { kind: 'restored', status: runtime.snapshot.status };
    if (identity.kind !== 'found' || identity.id.length === 0) {
      runtime.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
        reason: AUTH_REASON.STORAGE_FAILURE,
      });
      return { kind: 'storageBlocked', reason: 'installUnavailable' };
    }
    try {
      runtime.installDigest = await withPortDeadline(
        runtime.dependencies.timer,
        CRYPTO_DIGEST_TIMEOUT_MS,
        () =>
          digestInstallIdentity(identity.id, runtime.config.clientId, runtime.dependencies.crypto),
        PORT_OPERATION.CRYPTO_SHA256,
      );
    } catch {
      if (!runtime.isEpochCurrent(epoch))
        return { kind: 'restored', status: runtime.snapshot.status };
      runtime.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
        reason: AUTH_REASON.STORAGE_FAILURE,
      });
      return { kind: 'storageBlocked', reason: 'installUnavailable' };
    }
    let stored;
    try {
      stored = await withPortDeadline(
        runtime.dependencies.timer,
        CREDENTIAL_READ_TIMEOUT_MS,
        () => runtime.dependencies.credentials.read(),
        PORT_OPERATION.CREDENTIALS_READ,
      );
    } catch {
      stored = { kind: 'unavailable' as const };
    }
    if (!runtime.isEpochCurrent(epoch))
      return { kind: 'restored', status: runtime.snapshot.status };
    if (stored.kind === 'locked' || stored.kind === 'cancelled' || stored.kind === 'unavailable') {
      runtime.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
        reason: AUTH_REASON.STORAGE_FAILURE,
      });
      return { kind: 'storageBlocked', reason: stored.kind };
    }
    if (stored.kind === 'missing') {
      runtime.record = undefined;
      runtime.tokens = undefined;
      runtime.setState(SESSION_STATUS.SIGNED_OUT, AUTH_OPERATION.NONE);
      await readInitialAddress(runtime, signIn);
      return { kind: 'restored', status: runtime.snapshot.status };
    }
    if (stored.kind === 'corrupt') {
      return deleteInvalidRecord(runtime, epoch, AUTH_REASON.INVALID_RECORD);
    }
    const record = parseStoredRecord(stored.value);
    if (!record) return deleteInvalidRecord(runtime, epoch, AUTH_REASON.INVALID_RECORD);
    if (!recordMatches(record, runtime.config, runtime.installDigest)) {
      const reason =
        record.installDigest === runtime.installDigest
          ? AUTH_REASON.INVALID_RECORD
          : AUTH_REASON.INSTALL_MISMATCH;
      return deleteInvalidRecord(runtime, epoch, reason);
    }
    if (record.tokens && record.lineageId === undefined) {
      runtime.record = record;
      runtime.tokens = undefined;
      runtime.setState(SESSION_STATUS.REAUTH_REQUIRED, AUTH_OPERATION.NONE, {
        reason: AUTH_REASON.INVALID_RECORD,
      });
      return { kind: 'restored', status: runtime.snapshot.status };
    }
    runtime.record = record;
    if (record.refreshInFlight) {
      runtime.tokens = undefined;
      runtime.setState(SESSION_STATUS.REAUTH_REQUIRED, AUTH_OPERATION.NONE, {
        reason: AUTH_REASON.REFRESH_INTERRUPTED,
      });
      return { kind: 'restored', status: runtime.snapshot.status };
    }
    if (record.tokens) {
      let monotonicTime: number;
      try {
        monotonicTime = runtime.monotonicTime();
      } catch {
        runtime.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
          reason: AUTH_REASON.STORAGE_FAILURE,
        });
        return { kind: 'storageBlocked', reason: 'unavailable' };
      }
      runtime.installTokens('', record.tokens.refreshToken, monotonicTime, 0, record.lineageId);
      runtime.setState(SESSION_STATUS.SIGNED_IN, AUTH_OPERATION.NONE, {
        profile: runtime.snapshot.profile,
      });
      await readInitialAddress(runtime, signIn);
      return { kind: 'restored', status: runtime.snapshot.status };
    }
    if (record.transaction) {
      let wallTime: number;
      try {
        wallTime = runtime.wallTime();
      } catch {
        runtime.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
          reason: AUTH_REASON.STORAGE_FAILURE,
        });
        return { kind: 'storageBlocked', reason: 'unavailable' };
      }
      if (transactionExpired(record.transaction, wallTime)) {
        return deleteInvalidRecord(runtime, epoch, AUTH_REASON.INVALID_RECORD);
      }
      runtime.setState(SESSION_STATUS.SIGNED_OUT, AUTH_OPERATION.NONE);
      await readInitialAddress(runtime, signIn);
      return { kind: 'restored', status: runtime.snapshot.status };
    }
    return deleteInvalidRecord(runtime, epoch, AUTH_REASON.INVALID_RECORD);
  }

  async function deleteInvalidRecord(
    runtimeValue: AuthRuntime,
    epoch: number,
    reason: 'invalidRecord' | 'installMismatch',
  ): Promise<RestoreOutcome> {
    try {
      const deleted = await runtimeValue.deleteRecord(epoch);
      if (!deleted) return { kind: 'restored', status: runtimeValue.snapshot.status };
    } catch {
      if (!runtimeValue.isEpochCurrent(epoch))
        return { kind: 'restored', status: runtimeValue.snapshot.status };
      runtimeValue.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
        reason: AUTH_REASON.STORAGE_FAILURE,
      });
      return { kind: 'storageBlocked', reason: 'unavailable' };
    }
    runtimeValue.record = undefined;
    runtimeValue.tokens = undefined;
    runtimeValue.setState(SESSION_STATUS.SIGNED_OUT, AUTH_OPERATION.NONE, { reason });
    await readInitialAddress(runtimeValue, signIn);
    return { kind: 'restored', status: runtimeValue.snapshot.status };
  }

  return restore;
}

async function readInitialAddress(runtime: AuthRuntime, signIn: SignInController): Promise<void> {
  const epoch = runtime.epoch;
  let address: string | undefined;
  if (!runtime.initialAddressRead) {
    runtime.initialAddressRead = true;
    try {
      address = await withPortDeadline(
        runtime.dependencies.timer,
        CALLBACK_READ_TIMEOUT_MS,
        () => runtime.dependencies.callbacks.initialAddress(),
        PORT_OPERATION.CALLBACK_INITIAL_ADDRESS,
      );
    } catch {
      address = undefined;
    }
  }
  if (!runtime.isEpochCurrent(epoch)) return;
  await signIn.processInitialAddress(address);
}
