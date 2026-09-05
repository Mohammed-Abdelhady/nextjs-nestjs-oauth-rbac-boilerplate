/** Provider id for password sign-in. Kept as a plain string so comparisons
 * against dynamic provider ids stay type safe. */
export const EMAIL_PROVIDER = 'email';

export const SUPPORTED_OAUTH_PROVIDERS = [
  'google',
  'facebook',
  'github',
  'microsoft',
  'apple',
  'discord',
  'linkedin',
  'gitlab',
  'x',
  'slack',
  'twitch',
  'oidc',
] as const;

export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

/**
 * Id the generic OpenID Connect provider reads its `OAUTH_OIDC_*` variables
 * under. The id it is served on comes from OAUTH_OIDC_PROVIDER_ID and defaults
 * to this same value.
 */
export const GENERIC_OIDC_PROVIDER = 'oidc';
