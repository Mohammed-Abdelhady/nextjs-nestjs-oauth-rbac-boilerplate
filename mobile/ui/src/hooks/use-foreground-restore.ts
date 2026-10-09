import { useEffect } from 'react';
import { AppState } from 'react-native';

const ACTIVE = 'active';

/**
 * Restores on mount and each time the app returns to the foreground: the engine
 * learns that the device was unlocked only when it is asked.
 */
export function useForegroundRestore(restore: () => void): void {
  useEffect(() => {
    restore();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === ACTIVE) restore();
    });
    return () => subscription.remove();
  }, [restore]);
}
