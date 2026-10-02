import { createHash, timingSafeEqual } from 'crypto';

const PKCE_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

export function isPkceVerifier(value: string): boolean {
  return PKCE_PATTERN.test(value);
}

export function pkceS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!isPkceVerifier(verifier) || !isPkceVerifier(challenge)) {
    return false;
  }
  const actual = Buffer.from(pkceS256(verifier));
  const expected = Buffer.from(challenge);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
