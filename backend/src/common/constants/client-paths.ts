/**
 * Pages on the client the backend sends a browser to. They live here rather
 * than next to the feature that owns the page, so a redirect does not have to
 * import from a feature module.
 */

/** Fallback when a requested post-sign-in redirect is missing or unsafe. */
export const DEFAULT_REDIRECT_PATH = '/';

/** Where a sign-in that still owes a second factor continues. */
export const TWO_FACTOR_CLIENT_PATH = '/auth/2fa';

/** Browser confirmation page for a pending native sign-in request. */
export const NATIVE_AUTHORIZE_CLIENT_PATH = '/auth/native/authorize';

/** Query key carrying the pending native authorization transaction. */
export const NATIVE_TRANSACTION_QUERY_KEY = 'transaction';
