import type { AuthSnapshot } from '@app/native-auth';
import { STORAGE_WARNING, type StorageWarning } from './outcome-keys';

const SIGNED_IN: AuthSnapshot['status'] = 'signedIn';

/**
 * Which storage warning holds once an action has finished. The snapshot carries one
 * warning flag for three cases, so the case is read from what the action did.
 */
export function storageWarningAfter(
  previous: StorageWarning | undefined,
  snapshot: Pick<AuthSnapshot, 'status' | 'warning'>,
  refreshSent: boolean,
): StorageWarning | undefined {
  if (snapshot.warning === undefined) return undefined;
  // Outside a session the engine raises the warning only for a sign-out whose delete failed.
  if (snapshot.status !== SIGNED_IN) return STORAGE_WARNING.DELETE_FAILED;
  // A refresh went out and the warning is still up: what the session uses now is not on disk.
  if (refreshSent) return STORAGE_WARNING.SESSION_IN_MEMORY;
  // No refresh left the device, so a new warning is the refused write before one.
  return previous === STORAGE_WARNING.SESSION_IN_MEMORY
    ? STORAGE_WARNING.SESSION_IN_MEMORY
    : STORAGE_WARNING.REFRESH_NOT_SENT;
}
