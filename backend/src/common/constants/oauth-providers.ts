export const SUPPORTED_OAUTH_PROVIDERS = [
  'google',
  'facebook',
  'github',
] as const;

export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];
