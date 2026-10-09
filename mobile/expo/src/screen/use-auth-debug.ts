import type { AuthSnapshot } from '@app/native-auth';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ShellAuth } from '../shell';
import { DEBUG_ACTION, type DebugAction, type StorageWarning } from '../logic/outcome-keys';
import {
  describeAction,
  describeError,
  describeProfile,
  describeRefresh,
  describeRestore,
  describeSignIn,
  describeSignOut,
  type Described,
} from '../logic/outcome-text';
import { storageWarningAfter } from '../logic/storage-warning';

export interface AuthDebug {
  snapshot: AuthSnapshot;
  lastOutcome: Described | undefined;
  /** Set once the action that raised the snapshot's warning has finished. */
  storageWarning: StorageWarning | undefined;
  refreshTokenRequests: number;
  signIn(): void;
  refresh(): void;
  loadProfile(): void;
  signOut(): void;
}

export function useAuthDebug({ engine, client, debug }: ShellAuth): AuthDebug {
  const snapshot = useSyncExternalStore(
    useCallback((onChange: () => void) => engine.subscribe(onChange), [engine]),
    () => engine.snapshot,
  );
  const [lastOutcome, setLastOutcome] = useState<Described>();
  const [storageWarning, setStorageWarning] = useState<StorageWarning>();
  const [refreshTokenRequests, setRefreshTokenRequests] = useState(0);

  const run = useCallback(
    (action: DebugAction, work: () => Promise<Described>): void => {
      const sentBefore = debug.refreshTokenRequests();
      void work()
        .catch(describeError)
        .then((result) => {
          const sent = debug.refreshTokenRequests();
          const settled = engine.snapshot;
          setLastOutcome(describeAction(action, result));
          setRefreshTokenRequests(sent);
          setStorageWarning((previous) =>
            storageWarningAfter(previous, settled, sent > sentBefore),
          );
        });
    },
    [debug, engine],
  );

  const loadProfileText = useCallback(
    async (): Promise<Described> => describeProfile((await client.profile.get()).email),
    [client],
  );

  useEffect(() => {
    run(DEBUG_ACTION.RESTORE, async () => describeRestore(await engine.restore()));
  }, [engine, run]);

  return {
    snapshot,
    lastOutcome,
    storageWarning,
    refreshTokenRequests,
    signIn: useCallback(
      () => run(DEBUG_ACTION.SIGN_IN, async () => describeSignIn(await engine.signIn())),
      [engine, run],
    ),
    refresh: useCallback(
      () => run(DEBUG_ACTION.REFRESH, async () => describeRefresh(await engine.refresh())),
      [engine, run],
    ),
    loadProfile: useCallback(
      () => run(DEBUG_ACTION.PROFILE, loadProfileText),
      [loadProfileText, run],
    ),
    signOut: useCallback(
      () => run(DEBUG_ACTION.SIGN_OUT, async () => describeSignOut(await engine.signOut())),
      [engine, run],
    ),
  };
}
