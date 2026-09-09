/** Multi-provider injection token holding every registered strategy. */
export const OAUTH_STRATEGIES = 'OAUTH_STRATEGIES';

/** State cookies are named `oauth_<provider>`. */
export const OAUTH_STATE_COOKIE_PREFIX = 'oauth_';

/** How long a start request stays valid, in milliseconds. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** Bound on provider token, profile and JWKS HTTP. */
export const OAUTH_HTTP_TIMEOUT_MS = 10_000;

/** Minimum length of OAUTH_STATE_SECRET. */
export const OAUTH_STATE_SECRET_MIN_LENGTH = 32;

/** Path the client handles after the backend callback. */
export const OAUTH_CLIENT_CALLBACK_PATH = '/auth/oauth/callback';

/** Fallback redirect when the requested one is missing or unsafe. */
export const OAUTH_DEFAULT_REDIRECT = '/';
