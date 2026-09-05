/** Discovery endpoint that says which sign-in methods this deployment runs. */
export const AUTH_METHODS_PATH = '/api/auth/methods';

/** Sign-in method ids the registry can hold. */
export const AUTH_METHOD_ID = {
  PASSWORD: 'password',
  MAGIC_LINK: 'magicLink',
  /** Reserved for WebAuthn. Nothing renders it yet. */
  PASSKEYS: 'passkeys',
} as const;

export type AuthMethodId = (typeof AUTH_METHOD_ID)[keyof typeof AUTH_METHOD_ID];

/** Page the backend sends a challenged sign-in to. */
export const TWO_FACTOR_PATH = '/auth/2fa';

/** Page the mailed sign-in link points at. */
export const MAGIC_LINK_VERIFY_PATH = '/auth/magic-link/verify';

/** Query parameter carrying the page to open once the sign-in finishes. */
export const REDIRECT_PARAM = 'redirect';

/** Permissions that send an account to the admin dashboard by default. */
export const ADMIN_PERMISSIONS = [
  '*',
  'users:list:all',
  'roles:manage:all',
  'permissions:manage:all',
] as const;

export const DEFAULT_SIGNED_IN_PATH = '/dashboard';

export const ADMIN_SIGNED_IN_PATH = '/admin/dashboard';
