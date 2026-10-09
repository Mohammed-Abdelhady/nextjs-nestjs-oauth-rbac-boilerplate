/**
 * Which credential a request is authenticated with.
 *
 * A bearer token wins when one is sent, even when a session cookie is also
 * present. Both guards use this one rule so they never disagree.
 */
export const REQUEST_CREDENTIAL = {
  BEARER: 'bearer',
  COOKIE: 'cookie',
  NONE: 'none',
} as const;

export type RequestCredential =
  (typeof REQUEST_CREDENTIAL)[keyof typeof REQUEST_CREDENTIAL];

export function selectRequestCredential(
  hasBearerToken: boolean,
  hasSessionCookie: boolean,
): RequestCredential {
  if (hasBearerToken) {
    return REQUEST_CREDENTIAL.BEARER;
  }
  if (hasSessionCookie) {
    return REQUEST_CREDENTIAL.COOKIE;
  }
  return REQUEST_CREDENTIAL.NONE;
}

/**
 * Both credentials at once. A public route that acts on a browser session
 * refuses this with `MIXED_CREDENTIALS` instead of picking one silently.
 */
export function hasBothCredentials(
  hasBearerToken: boolean,
  hasSessionCookie: boolean,
): boolean {
  return hasBearerToken && hasSessionCookie;
}
