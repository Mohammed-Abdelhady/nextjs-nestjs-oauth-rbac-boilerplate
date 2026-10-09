import {
  MONGO_TRANSIENT_TRANSACTION_LABEL,
  MONGO_UNAVAILABLE_CODES,
} from '../../../common/constants/mongo-errors';
import { isUnknownTransactionOutcome } from '../../../common/exceptions/unknown-transaction-outcome.error';
import {
  MalformedIdError,
  PersistenceTimeoutError,
  PersistenceUnavailableError,
  RetryableAbortError,
  UniqueConflictError,
} from '../../../common/persistence/persistence-errors';
import {
  isCastError,
  isDatabaseUnavailableError,
  isMongoDuplicateKeyError,
} from '../../../common/utils/mongo-error.util';
import { ROLE_CONSTRAINT } from '../../../role/stores/role-records';
import { ISSUANCE_CONSTRAINT } from '../../issuance/browser-issuance.store';

/** MaxTimeMSExpired, NetworkTimeout, ExceededTimeLimit. */
const MONGO_TIMEOUT_CODES: ReadonlySet<number> = new Set([50, 89, 262]);

const INDEX_NAME_PATTERN = / index: (\S+) dup key/;

/** Index name to the rule's shared name. An unlisted index keeps its own name. */
const MONGO_INDEX_CONSTRAINTS: Readonly<Record<string, string>> = {
  eventId_1: ISSUANCE_CONSTRAINT.SECURITY_EVENT_ID,
  tokenHash_unique: ISSUANCE_CONSTRAINT.SESSION_TOKEN_HASH,
  grant_user_client_unique: ISSUANCE_CONSTRAINT.GRANT_USER_CLIENT,
  slug_1: ROLE_CONSTRAINT.SLUG,
};

const UNNAMED_CONSTRAINT = 'unnamed';

function constraintOf(error: { message: string }): string {
  const index = INDEX_NAME_PATTERN.exec(error.message)?.[1];
  if (!index) {
    return UNNAMED_CONSTRAINT;
  }
  return MONGO_INDEX_CONSTRAINTS[index] ?? index;
}

function hasLabel(error: unknown, label: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  if (!('errorLabels' in error) || !Array.isArray(error.errorLabels)) {
    return false;
  }
  const labels: unknown[] = error.errorLabels;
  return labels.includes(label);
}

function codeOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'number' ? error.code : undefined;
}

/**
 * The shared error for a driver failure. Anything else, an application error or
 * one that is already shared, comes back as it went in.
 */
export function mapMongoError(error: unknown): unknown {
  if (isMongoDuplicateKeyError(error)) {
    return new UniqueConflictError(constraintOf(error), error);
  }
  if (isCastError(error)) {
    return new MalformedIdError(error);
  }
  if (hasLabel(error, MONGO_TRANSIENT_TRANSACTION_LABEL)) {
    return new RetryableAbortError(error);
  }
  const code = codeOf(error);
  if (code !== undefined && MONGO_TIMEOUT_CODES.has(code)) {
    return new PersistenceTimeoutError(error);
  }
  if (
    (code !== undefined && MONGO_UNAVAILABLE_CODES.has(code)) ||
    isUnavailable(error)
  ) {
    return new PersistenceUnavailableError(error);
  }
  return error;
}

/** Unknown outcomes are already shared and must not be reported as an outage. */
function isUnavailable(error: unknown): boolean {
  return (
    !isUnknownTransactionOutcome(error) && isDatabaseUnavailableError(error)
  );
}
