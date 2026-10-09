import {
  MalformedIdError,
  PersistenceTimeoutError,
  PersistenceUnavailableError,
  RetryableAbortError,
  UniqueConflictError,
} from '../../../src/common/persistence/persistence-errors';
import { ROLE_CONSTRAINT } from '../../../src/role/stores/role-records';
import { ISSUANCE_CONSTRAINT } from '../../../src/session/issuance/browser-issuance.store';

/** SQLSTATE codes the adapter gives a meaning to. */
export const SQLSTATE = {
  UNIQUE_VIOLATION: '23505',
  INVALID_TEXT_REPRESENTATION: '22P02',
  IN_FAILED_SQL_TRANSACTION: '25P02',
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
  LOCK_NOT_AVAILABLE: '55P03',
  QUERY_CANCELED: '57014',
  ADMIN_SHUTDOWN: '57P01',
  CRASH_SHUTDOWN: '57P02',
  CANNOT_CONNECT_NOW: '57P03',
  TOO_MANY_CONNECTIONS: '53300',
} as const;

const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;
const CONNECTION_EXCEPTION_CLASS = '08';

const RETRYABLE_STATES: ReadonlySet<string> = new Set([
  SQLSTATE.SERIALIZATION_FAILURE,
  SQLSTATE.DEADLOCK_DETECTED,
  SQLSTATE.LOCK_NOT_AVAILABLE,
]);

const UNAVAILABLE_STATES: ReadonlySet<string> = new Set([
  SQLSTATE.ADMIN_SHUTDOWN,
  SQLSTATE.CRASH_SHUTDOWN,
  SQLSTATE.CANNOT_CONNECT_NOW,
  SQLSTATE.TOO_MANY_CONNECTIONS,
]);

/** Socket failures the driver passes through with Node's own code. */
const UNAVAILABLE_SOCKET_CODES: ReadonlySet<string> = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ENOTFOUND',
  'EHOSTUNREACH',
]);

const TIMEOUT_SOCKET_CODES: ReadonlySet<string> = new Set(['ETIMEDOUT']);

/** Constraint name to the rule's shared name. An unlisted one keeps its own. */
const POSTGRES_CONSTRAINTS: Readonly<Record<string, string>> = {
  security_event_id_unique: ISSUANCE_CONSTRAINT.SECURITY_EVENT_ID,
  session_token_hash_unique: ISSUANCE_CONSTRAINT.SESSION_TOKEN_HASH,
  grant_user_client_unique: ISSUANCE_CONSTRAINT.GRANT_USER_CLIENT,
  role_slug_unique: ROLE_CONSTRAINT.SLUG,
};

const UNNAMED_CONSTRAINT = 'unnamed';

function textField(error: object, field: string): string | undefined {
  const value: unknown = Reflect.get(error, field);
  return typeof value === 'string' ? value : undefined;
}

/** The server's SQLSTATE, when the server is the one that answered. */
export function sqlStateOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const code = textField(error, 'code');
  return code !== undefined && SQLSTATE_PATTERN.test(code) ? code : undefined;
}

function constraintOf(error: object): string {
  const name = textField(error, 'constraint');
  if (!name) {
    return UNNAMED_CONSTRAINT;
  }
  return POSTGRES_CONSTRAINTS[name] ?? name;
}

function mapSqlState(state: string, error: object): unknown {
  if (state === SQLSTATE.UNIQUE_VIOLATION) {
    return new UniqueConflictError(constraintOf(error), error);
  }
  if (state === SQLSTATE.INVALID_TEXT_REPRESENTATION) {
    return new MalformedIdError(error);
  }
  if (RETRYABLE_STATES.has(state)) {
    return new RetryableAbortError(error);
  }
  if (state === SQLSTATE.QUERY_CANCELED) {
    return new PersistenceTimeoutError(error);
  }
  if (
    state.startsWith(CONNECTION_EXCEPTION_CLASS) ||
    UNAVAILABLE_STATES.has(state)
  ) {
    return new PersistenceUnavailableError(error);
  }
  return error;
}

/**
 * The shared error for a driver failure. Anything else, an application error or
 * one that is already shared, comes back as it went in.
 */
export function mapPostgresError(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) {
    return error;
  }
  const state = sqlStateOf(error);
  if (state !== undefined) {
    return mapSqlState(state, error);
  }
  const socketCode = textField(error, 'code');
  if (socketCode !== undefined && TIMEOUT_SOCKET_CODES.has(socketCode)) {
    return new PersistenceTimeoutError(error);
  }
  if (socketCode !== undefined && UNAVAILABLE_SOCKET_CODES.has(socketCode)) {
    return new PersistenceUnavailableError(error);
  }
  return error;
}
