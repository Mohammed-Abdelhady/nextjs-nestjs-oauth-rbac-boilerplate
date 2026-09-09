/**
 * Pages on the client the backend sends a browser to. They live here rather
 * than next to the feature that owns the page, so a redirect does not have to
 * import from a feature module.
 */

/** Where a sign-in that still owes a second factor continues. */
export const TWO_FACTOR_CLIENT_PATH = '/auth/2fa';
