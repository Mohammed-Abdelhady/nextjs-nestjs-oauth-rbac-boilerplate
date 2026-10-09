/**
 * What the native authorize page is told about a transaction.
 *
 * The read endpoint deliberately withholds the redirect address, the PKCE
 * challenge and the state; only these fields cross the wire.
 */
export interface NativeAuthorizeTransaction {
  applicationName: string;
  platform: string;
  expiresAt: string;
  alreadyGranted: boolean;
}

/** The address the browser is sent to once the transaction ends. */
export interface NativeAuthorizeRedirect {
  redirectUri: string;
}

/** Body of an approve or deny call. */
export interface NativeAuthorizeActionRequest {
  transactionId: string;
  /** The account the card showed; the server refuses any other session. */
  expectedUserId: string;
}
