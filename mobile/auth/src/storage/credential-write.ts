import { CREDENTIAL_WRITE_DONE, PORT_OPERATION, STORE_CONDITION } from '../constants';
import { CredentialStoreError, type CredentialStoreCondition } from '../errors/errors';
import type { AuthRuntime } from '../runtime/runtime';
import type { CredentialWriteResult } from '../types/auth';

// A refused write is thrown, so every path that handled a failed write still does.
function expectDone(result: CredentialWriteResult, operation: string): void {
  if (result.kind !== CREDENTIAL_WRITE_DONE) throw new CredentialStoreError(operation, result.kind);
}

export async function replaceStoredRecord(runtime: AuthRuntime, value: string): Promise<void> {
  expectDone(
    await runtime.dependencies.credentials.replace(value),
    PORT_OPERATION.CREDENTIALS_REPLACE,
  );
}

export async function deleteStoredRecord(runtime: AuthRuntime): Promise<void> {
  expectDone(await runtime.dependencies.credentials.delete(), PORT_OPERATION.CREDENTIALS_DELETE);
}

/** Why a write did not happen, for an outcome. An unknown failure reads as unavailable. */
export function storeCondition(error: unknown): CredentialStoreCondition {
  return error instanceof CredentialStoreError ? error.condition : STORE_CONDITION.UNAVAILABLE;
}

export function isStoreLocked(error: unknown): boolean {
  return storeCondition(error) === STORE_CONDITION.LOCKED;
}
