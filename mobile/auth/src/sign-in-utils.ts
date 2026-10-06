import { MAX_QUEUED_CALLBACKS, MIN_OAUTH_STATE_CHARACTERS } from './constants';
import { constantTimeEqual } from './persistence';
import { parseCallback, parseUri } from './redirect';
import type { AuthTransaction } from './types/record';

export function matchesTransactionState(
  address: string,
  transaction: AuthTransaction | undefined,
): boolean {
  if (!transaction) return false;
  const expected = parseUri(transaction.returnAddress);
  if (!expected) return false;
  const callback = parseCallback(address, expected);
  return callback.kind !== 'invalid' && constantTimeEqual(callback.state, transaction.state);
}

export function queueRestoringAddress(
  queue: string[],
  address: string,
  transaction: AuthTransaction | undefined,
): void {
  if (queue.length < MAX_QUEUED_CALLBACKS) {
    queue.push(address);
    return;
  }
  const oldestWrongState = transaction
    ? queue.findIndex((candidate) => !matchesTransactionState(candidate, transaction))
    : -1;
  queue.splice(oldestWrongState < 0 ? 0 : oldestWrongState, 1);
  queue.push(address);
}

export function isCallbackAddress(address: string): boolean {
  const parsed = parseUri(address);
  if (!parsed) return false;
  const callback = parseCallback(address, parsed);
  return callback.kind !== 'invalid' && callback.state.length >= MIN_OAUTH_STATE_CHARACTERS;
}

export function asSignInError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function cancelSignInDeadline(cancel: () => void): void {
  try {
    cancel();
  } catch {
    return;
  }
}
