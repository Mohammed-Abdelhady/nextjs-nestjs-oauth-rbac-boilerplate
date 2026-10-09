import { REFRESH_OUTCOME, SESSION_STATUS } from '../constants';
import type { RefreshCoordinator } from './refresh';
import type { AuthRuntime } from '../runtime/runtime';
import type { RefreshOutcome } from '../types/auth';

/** The public refresh: the same single flight a request with an expired token joins. */
export function createRefreshNow(
  runtime: AuthRuntime,
  coordinator: RefreshCoordinator,
): () => Promise<RefreshOutcome> {
  return () => {
    if (runtime.disposed) return Promise.resolve({ kind: REFRESH_OUTCOME.DISPOSED });
    if (!runtime.tokens || runtime.snapshot.status !== SESSION_STATUS.SIGNED_IN)
      return Promise.resolve({ kind: REFRESH_OUTCOME.NOT_SIGNED_IN });
    const refreshing = coordinator.refresh().then(
      (): RefreshOutcome => ({ kind: REFRESH_OUTCOME.REFRESHED }),
      (error: unknown): RefreshOutcome =>
        runtime.disposed
          ? { kind: REFRESH_OUTCOME.DISPOSED }
          : { kind: REFRESH_OUTCOME.FAILED, error: asError(error) },
    );
    return runtime.raceWithDispose(refreshing, (): RefreshOutcome => ({
      kind: REFRESH_OUTCOME.DISPOSED,
    }));
  };
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
