/** Provider id for password sign-in. Kept as a plain string so comparisons
 * against dynamic provider ids stay type safe. */
export const EMAIL_PROVIDER = 'email';

export const SUPPORTED_OAUTH_PROVIDERS = [
  'google',
  'facebook',
  'github',
] as const;

export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];
