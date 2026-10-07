import type { SecureStoreApi, SecureStoreOptionsApi } from '../../src/types/modules';

/** The shape Expo modules reject with: an `Error` carrying a `code`. */
export class FakeCodedError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Messages copied by hand from `expo-secure-store` 57.0.4, `SecureStoreExceptions.swift`. */
export const IOS_KEYCHAIN_FAILURE = {
  locked: 'User interaction is not allowed.',
  cancelled: 'User canceled the operation.',
  corrupt: 'Unable to decode the provided data.',
  unavailable: 'No keychain is available. You may need to restart your computer.',
} as const;

export function keychainError(reason: string, call: string): FakeCodedError {
  return new FakeCodedError(
    'ERR_KEY_CHAIN',
    `Calling the '${call}' function has failed\n→ Caused by: ${reason}`,
  );
}

export interface StoreCall {
  call: 'get' | 'set' | 'delete';
  key: string;
  options: SecureStoreOptionsApi | undefined;
}

/** `expo-secure-store` as the adapters see it, with the keychain's failures. */
export class FakeSecureStore implements SecureStoreApi {
  readonly items = new Map<string, string>();
  readonly calls: StoreCall[] = [];
  readFailure: string | undefined;
  /** Limits the read failure to one item, as when two items differ in accessibility. */
  readFailureKey: string | undefined;
  failNextSet = false;

  reset(): void {
    this.items.clear();
    this.calls.length = 0;
    this.readFailure = undefined;
    this.readFailureKey = undefined;
    this.failNextSet = false;
  }

  async getItemAsync(key: string, options?: SecureStoreOptionsApi): Promise<string | null> {
    this.record('get', key, options);
    const affected = this.readFailureKey === undefined || this.readFailureKey === key;
    if (this.readFailure !== undefined && affected) {
      throw keychainError(this.readFailure, 'getValueWithKeyAsync');
    }
    return this.items.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string, options?: SecureStoreOptionsApi): Promise<void> {
    this.record('set', key, options);
    if (this.failNextSet) {
      this.failNextSet = false;
      throw keychainError('I/O error.', 'setValueWithKeyAsync');
    }
    this.items.set(key, value);
  }

  async deleteItemAsync(key: string, options?: SecureStoreOptionsApi): Promise<void> {
    this.record('delete', key, options);
    this.items.delete(key);
  }

  private record(call: StoreCall['call'], key: string, options?: SecureStoreOptionsApi): void {
    // The real module refuses any other key before it reaches the keychain.
    if (!/^[\w.-]+$/.test(key)) throw new Error('Invalid key provided to SecureStore.');
    this.calls.push({ call, key, options });
  }
}
