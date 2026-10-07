import type { AuthSnapshot } from '@app/native-auth';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ShellAuth } from '../shell';
import { describeError, describeOutcome } from '../logic/outcome-text';

export const DEBUG_ACTION = {
  RESTORE: 'restore',
  SIGN_IN: 'signIn',
  REFRESH: 'refresh',
  PROFILE: 'profile',
  SIGN_OUT: 'signOut',
} as const;
type DebugAction = (typeof DEBUG_ACTION)[keyof typeof DEBUG_ACTION];

export interface AuthDebug {
  snapshot: AuthSnapshot;
  lastOutcome: string | undefined;
  refreshRequests: number;
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
  const [lastOutcome, setLastOutcome] = useState<string>();
  const [refreshRequests, setRefreshRequests] = useState(0);

  const run = useCallback(
    (action: DebugAction, work: () => Promise<string>): void => {
      void work()
        .catch(describeError)
        .then((text) => {
          setLastOutcome(`${action}: ${text}`);
          setRefreshRequests(debug.refreshRequests());
        });
    },
    [debug],
  );

  const loadProfileText = useCallback(
    async (): Promise<string> => (await client.profile.get()).email,
    [client],
  );

  useEffect(() => {
    run(DEBUG_ACTION.RESTORE, async () => describeOutcome(await engine.restore()));
  }, [engine, run]);

  return {
    snapshot,
    lastOutcome,
    refreshRequests,
    signIn: useCallback(
      () => run(DEBUG_ACTION.SIGN_IN, async () => describeOutcome(await engine.signIn())),
      [engine, run],
    ),
    refresh: useCallback(
      () =>
        run(DEBUG_ACTION.REFRESH, () => {
          debug.expireNextRequest();
          return loadProfileText();
        }),
      [debug, loadProfileText, run],
    ),
    loadProfile: useCallback(
      () => run(DEBUG_ACTION.PROFILE, loadProfileText),
      [loadProfileText, run],
    ),
    signOut: useCallback(
      () => run(DEBUG_ACTION.SIGN_OUT, async () => describeOutcome(await engine.signOut())),
      [engine, run],
    ),
  };
}
