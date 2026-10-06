export const SECURITY_EVENT_ACTION = {
  ROLE_DELETED: 'role_deleted',
  SESSION_ISSUED: 'session_issued',
  SESSION_REVOKED: 'session_revoked',
  SESSIONS_REVOKED_ALL: 'sessions_revoked_all',
  SESSIONS_REVOKED_OTHERS: 'sessions_revoked_others',
  GRANT_BLOCKED: 'grant_blocked',
  APPLICATION_DISABLED: 'application_disabled',
  APPLICATION_ENABLED: 'application_enabled',
  REFRESH_REPLAYED: 'refresh_replayed',
  NATIVE_CLIENT_REVOKED: 'native_client_revoked',
  NATIVE_DPOP_PROOF_REFUSED: 'native_dpop_proof_refused',
} as const;

export const SECURITY_EVENT_OUTCOME = {
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const;

export const ROLE_DELETION_EVENT_PREFIX = 'role-deletion:';
