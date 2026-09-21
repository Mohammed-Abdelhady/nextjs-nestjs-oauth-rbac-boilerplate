export const REVOKED_REASON = {
  CURRENT: 'current_logout',
  SELECTED: 'selected_revoke',
  ALL_USER: 'all_user',
  ALL_OTHER: 'all_other',
  GRANT_BLOCKED: 'grant_blocked',
  APPLICATION_DISABLED: 'application_disabled',
} as const;

export type RevokedReason =
  (typeof REVOKED_REASON)[keyof typeof REVOKED_REASON];
