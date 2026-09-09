import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Cookie values of the form `<base64url payload>.<base64url HMAC-SHA256>`, the
 * same construction the OAuth state and two-factor challenge cookies use. The
 * payload is readable by the client on purpose; the signature is what stops it
 * being edited.
 */

export function signPayload(encodedPayload: string, key: Buffer): string {
  return createHmac('sha256', key).update(encodedPayload).digest('base64url');
}

export function encodeSignedCookie(payload: object, key: Buffer): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signPayload(encoded, key)}`;
}

/**
 * Reads a cookie written by {@link encodeSignedCookie}.
 *
 * @returns the parsed payload, or null when the value is missing, malformed or
 * carries a signature that does not match. Callers turn null into whichever
 * error their route reports, so nothing here leaks which of the three it was.
 */
export function decodeSignedCookie<T>(
  raw: string | undefined,
  key: Buffer,
): T | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }

  const separator = raw.lastIndexOf('.');
  if (separator <= 0) {
    return null;
  }

  const encoded = raw.slice(0, separator);
  if (
    !constantTimeEquals(raw.slice(separator + 1), signPayload(encoded, key))
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  return timingSafeEqual(leftBytes, rightBytes);
}
