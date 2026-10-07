import type { CredentialsPort } from '@app/native-auth';
import { storeConditionFromError } from '../logic/secure-store-errors';
import type { SecureStoreApi, SecureStoreOptionsApi } from '../types/modules';

/** One keychain item, so a replace is a single write the system applies whole. */
export function createCredentialsPort(
  store: SecureStoreApi,
  key: string,
  options: SecureStoreOptionsApi,
): CredentialsPort {
  return {
    async read() {
      try {
        const value = await store.getItemAsync(key, options);
        // Android removes an entry it cannot decrypt and answers null: that reads as missing.
        return typeof value === 'string' ? { kind: 'found', value } : { kind: 'missing' };
      } catch (error) {
        return { kind: storeConditionFromError(error) };
      }
    },
    replace: (value) => store.setItemAsync(key, value, options),
    delete: () => store.deleteItemAsync(key, options),
  };
}
