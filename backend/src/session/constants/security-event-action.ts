export const SECURITY_EVENT_ACTION = {
  SESSION_ISSUED: 'session_issued',
  SESSION_REVOKED: 'session_revoked',
  SESSIONS_REVOKED_ALL: 'sessions_revoked_all',
  SESSIONS_REVOKED_OTHERS: 'sessions_revoked_others',
  GRANT_BLOCKED: 'grant_blocked',
  APPLICATION_DISABLED: 'application_disabled',
  APPLICATION_ENABLED: 'application_enabled',
} as const;

export const SECURITY_EVENT_OUTCOME = {
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const;
