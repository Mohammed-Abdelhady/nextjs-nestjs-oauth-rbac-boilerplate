import { createElement } from 'react';
import { LocalizedToastMessage } from '@/components/ui/LocalizedToastMessage';
import { ERROR_MESSAGES } from '@/constants/toastMessages';
import { toast } from '@/lib/toast';

/**
 * What `.unwrap()` rejects with: the answer the server or the network gave, or
 * the query layer's serialized error. Both are plain objects, never an `Error`.
 */
function isRequestRejection(error: unknown): boolean {
  return typeof error === 'object' && error !== null && !(error instanceof Error);
}

/**
 * For the catch around a request. A rejected request, a 401 included, is an
 * expected failure: the store's error interceptor has dealt with it, so this
 * does nothing and never rethrows it. Anything else is a failure nobody
 * reported: the person gets the generic message and the error goes on.
 *
 * @example
 * ```tsx
 * try {
 *   await save(data).unwrap();
 * } catch (error) {
 *   reportUnlessHandled(error);
 * }
 * ```
 */
export function reportUnlessHandled(error: unknown): void {
  if (isRequestRejection(error)) {
    return;
  }
  toast.error(createElement(LocalizedToastMessage, { messageKey: ERROR_MESSAGES.UNKNOWN_ERROR }));
  throw error;
}
