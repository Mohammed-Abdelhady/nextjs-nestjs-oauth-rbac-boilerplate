import type { CredentialWriteResult, CredentialsPort } from '@app/native-auth';
import { storeConditionFromError, writeConditionFromError } from '../logic/secure-store-errors';
import type { RecordMarkerApi, SecureStoreApi, SecureStoreOptionsApi } from '../types/modules';

const DONE: CredentialWriteResult = { kind: 'done' };

function markWritten(marker: RecordMarkerApi): void {
  try {
    if (!marker.exists) marker.create();
  } catch {
    // The record is saved. Without its marker a discarded record reads as missing.
  }
}

function clearMarker(marker: RecordMarkerApi): void {
  try {
    if (marker.exists) marker.delete();
  } catch {
    // The record is gone. A marker left behind reads as corrupt, and the engine deletes again.
  }
}

/**
 * One keychain item, so a replace is a single write the system applies whole.
 * The marker is a plain file written after the item and removed after it.
 */
export function createCredentialsPort(
  store: SecureStoreApi,
  key: string,
  options: SecureStoreOptionsApi,
  marker: RecordMarkerApi,
): CredentialsPort {
  return {
    async read() {
      try {
        const value = await store.getItemAsync(key, options);
        if (typeof value === 'string') return { kind: 'found', value };
        // Android removes an entry it cannot decrypt and answers null, as an empty store does.
        return marker.exists ? { kind: 'corrupt' } : { kind: 'missing' };
      } catch (error) {
        return { kind: storeConditionFromError(error) };
      }
    },
    async replace(value) {
      try {
        await store.setItemAsync(key, value, options);
      } catch (error) {
        return { kind: writeConditionFromError(error) };
      }
      markWritten(marker);
      return DONE;
    },
    async delete() {
      try {
        await store.deleteItemAsync(key, options);
      } catch (error) {
        return { kind: writeConditionFromError(error) };
      }
      clearMarker(marker);
      return DONE;
    },
  };
}
