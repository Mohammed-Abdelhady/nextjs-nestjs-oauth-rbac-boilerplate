import type { AuthSnapshot } from '@app/native-auth';
import { useCallback, useSyncExternalStore } from 'react';
import type { EnginePort } from '../types';

export function useEngineSnapshot(engine: EnginePort): AuthSnapshot {
  return useSyncExternalStore(
    useCallback((onChange: () => void) => engine.subscribe(onChange), [engine]),
    () => engine.snapshot,
  );
}
