import { AUTH_OPERATION, AUTH_REASON, SESSION_STATUS } from '../constants';
import { makeRefreshRecord } from '../refresh/refresh-helpers';
import { finishRefresh } from '../refresh/refresh-state';
import type { AuthRuntime } from '../runtime/runtime';

/**
 * Saves the session held in memory after a locked store refused it. The write
 * joins the storage queue, so a refresh that starts meanwhile saves its marker after it.
 */
export function saveSessionAfterUnlock(runtime: AuthRuntime): Promise<void> | undefined {
  if (runtime.sessionSave) return runtime.sessionSave;
  const { tokens, installDigest, snapshot } = runtime;
  if (
    !tokens ||
    !installDigest ||
    snapshot.status !== SESSION_STATUS.SIGNED_IN ||
    snapshot.operation !== AUTH_OPERATION.NONE ||
    snapshot.warning === undefined ||
    snapshot.reason !== AUTH_REASON.STORAGE_LOCKED
  )
    return undefined;
  const epoch = runtime.epoch;
  const unchanged = (): boolean =>
    runtime.isEpochCurrent(epoch) &&
    runtime.tokens === tokens &&
    runtime.snapshot.status === SESSION_STATUS.SIGNED_IN &&
    runtime.snapshot.operation === AUTH_OPERATION.NONE;
  const saving = runtime
    .replaceRecord(makeRefreshRecord(runtime, installDigest, tokens), epoch)
    .then(
      (written) => {
        if (written && unchanged()) finishRefresh(runtime);
      },
      (refused: unknown) => {
        if (unchanged()) finishRefresh(runtime, true, refused);
      },
    )
    .finally(() => {
      if (runtime.sessionSave === saving) runtime.sessionSave = undefined;
    });
  runtime.sessionSave = saving;
  return saving;
}
