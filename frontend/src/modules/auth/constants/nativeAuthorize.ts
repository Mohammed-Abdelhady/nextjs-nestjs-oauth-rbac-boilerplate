/**
 * The browser step of native sign-in.
 *
 * The mobile app opens the browser on this route, the backend hands it a
 * transaction id, and the browser approves or denies that transaction.
 */

/** Web route the browser lands on, after the locale segment. */
export const NATIVE_AUTHORIZE_PATH = '/auth/native/authorize';

/** Query key carrying the transaction id on that route. */
export const NATIVE_TRANSACTION_PARAM = 'transaction';

/** Read the transaction the browser is approving. Never returns the secrets. */
export function nativeAuthorizeTransactionEndpoint(transactionId: string): string {
  return `/api/oauth/authorize/transaction/${encodeURIComponent(transactionId)}`;
}

/** Ends the transaction and answers with the redirect address carrying the code. */
export const NATIVE_AUTHORIZE_APPROVE_ENDPOINT = '/api/oauth/authorize/approve';

/** Ends the transaction and answers with the redirect address carrying access_denied. */
export const NATIVE_AUTHORIZE_DENY_ENDPOINT = '/api/oauth/authorize/deny';

/**
 * The native authorize route with a transaction, as a locale-less relative
 * path. This is what a signed-out visitor carries to sign-in and back, and what
 * a mailed link stores for a browser that has no session yet.
 */
export function nativeAuthorizeContinuation(transaction: string): string {
  return `${NATIVE_AUTHORIZE_PATH}?${NATIVE_TRANSACTION_PARAM}=${encodeURIComponent(transaction)}`;
}

/**
 * True when an already-validated path is exactly the native authorize
 * continuation. Used to decide whether a continuation is worth mailing.
 */
export function isNativeAuthorizeContinuation(path: string): boolean {
  return path.startsWith(`${NATIVE_AUTHORIZE_PATH}?${NATIVE_TRANSACTION_PARAM}=`);
}
