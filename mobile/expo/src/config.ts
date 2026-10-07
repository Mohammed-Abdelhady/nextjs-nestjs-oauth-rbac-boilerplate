import { resolveConfig } from './logic/resolve-config';

/** Expo replaces the variable at bundle time, so it has to be read by its full name. */
export const AUTH_CONFIGURATION = resolveConfig({
  apiOrigin: process.env.EXPO_PUBLIC_API_ORIGIN,
  development: __DEV__,
});

/**
 * A private browser session: sign-in never reuses a cookie from an earlier
 * case, and iOS does not ask for permission to share one.
 */
export const EPHEMERAL_BROWSER_SESSION = true;
