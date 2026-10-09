import { isUnknownTransactionOutcome } from '../../common/exceptions/unknown-transaction-outcome.error';
import {
  isPersistenceError,
  PERSISTENCE_ERROR_KIND,
  PersistenceErrorKind,
} from '../../common/persistence/persistence-errors';
import { describeDriverError } from '../../common/utils/describe-error.util';

const OUTAGE_KINDS: ReadonlySet<PersistenceErrorKind> = new Set([
  PERSISTENCE_ERROR_KIND.RETRYABLE_ABORT,
  PERSISTENCE_ERROR_KIND.TIMEOUT,
  PERSISTENCE_ERROR_KIND.UNAVAILABLE,
]);

/** True for an outage, an exhausted rerun, or a commit with no answer. */
export function isStoreOutage(error: unknown): boolean {
  if (isUnknownTransactionOutcome(error)) {
    return true;
  }
  return isPersistenceError(error) && OUTAGE_KINDS.has(error.kind);
}

/**
 * Names the failure for a log line. A shared persistence error is named by the
 * database failure under it, which is what an operator has to look up.
 */
export function describeStoreFailure(error: unknown): string {
  if (isPersistenceError(error) && error.cause !== undefined) {
    return describeDriverError(error.cause);
  }
  return describeDriverError(error);
}
