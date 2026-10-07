import type { InstallIdentityResult, InstallPort } from '@app/native-auth';
import type {
  MarkerFileApi,
  SecureStoreApi,
  SecureStoreOptionsApi,
  UuidApi,
} from '../types/modules';

export interface InstallModules {
  store: SecureStoreApi;
  marker: MarkerFileApi;
  uuid: UuidApi;
}

/**
 * The iOS keychain outlives an uninstall and the marker file does not, so an
 * id without its marker belongs to an earlier install. A marker without an id
 * is a backup restored to another device, or a keychain item that was lost:
 * the two look the same here, and both get a new id.
 */
export function createInstallPort(
  modules: InstallModules,
  key: string,
  options: SecureStoreOptionsApi,
): InstallPort {
  let pending: Promise<InstallIdentityResult> | undefined;

  const load = async (): Promise<InstallIdentityResult> => {
    try {
      const marked = modules.marker.exists;
      const stored = marked ? await modules.store.getItemAsync(key, options) : null;
      if (typeof stored === 'string' && stored.length > 0) return { kind: 'found', id: stored };
      const id = modules.uuid.randomUUID();
      await modules.store.setItemAsync(key, id, options);
      if (!marked) modules.marker.create();
      return { kind: 'found', id };
    } catch {
      return { kind: 'unavailable' };
    }
  };

  return {
    identity() {
      // Two first reads at once would otherwise each make an id.
      pending ??= load().finally(() => {
        pending = undefined;
      });
      return pending;
    },
  };
}
