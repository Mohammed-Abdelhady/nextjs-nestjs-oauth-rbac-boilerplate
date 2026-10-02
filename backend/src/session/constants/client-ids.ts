export const WEB_CLIENT_ID = 'web';
export const ADMIN_CLIENT_ID = 'admin';

export const APPLICATION_PLATFORM = {
  WEB: 'web',
  ADMIN: 'admin',
  NATIVE: 'native',
} as const;

export type ApplicationPlatform =
  (typeof APPLICATION_PLATFORM)[keyof typeof APPLICATION_PLATFORM];

export const APPLICATION_CLIENT_TYPE = {
  PUBLIC: 'public',
  CONFIDENTIAL: 'confidential',
} as const;

export const DEFAULT_API_AUDIENCE = 'api';
