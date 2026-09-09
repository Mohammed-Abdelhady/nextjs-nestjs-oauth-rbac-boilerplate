import type { PersistConfig, PersistedState, Storage } from 'redux-persist';
import type { AuthState } from '@/modules/auth/types/auth.types';

/** Only a boolean hint survives reload; server validation supplies the user. */
export function authPersistence(storage: Storage): PersistConfig<AuthState> {
  return {
    key: 'auth',
    version: 2,
    storage,
    whitelist: ['isAuthenticated'],
    migrate: (state: PersistedState): Promise<PersistedState> => {
      if (!state) return Promise.resolve(undefined);
      const saved = state as unknown as Record<string, unknown>;
      // Old transforms wrapped every field, including loading and persistence metadata.
      return Promise.resolve({
        isAuthenticated: saved.isAuthenticated === true,
        _persist: { version: 2, rehydrated: false },
      });
    },
  };
}
