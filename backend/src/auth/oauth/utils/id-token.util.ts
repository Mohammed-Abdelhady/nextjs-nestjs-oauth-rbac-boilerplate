import { createPublicKey, verify as verifySignature } from 'node:crypto';

/**
 * Minimal RS256 id_token verification against a provider JWKS endpoint.
 * Kept in one file so it can be swapped for a JOSE library without touching
 * the strategies.
 */

interface JwksKey {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

interface JwksResponse {
  keys: JwksKey[];
}

interface IdTokenHeader {
  alg?: string;
  kid?: string;
}

export interface IdTokenClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface VerifyIdTokenOptions {
  idToken: string;
  jwksUri: string;
  issuers: string[];
  audience: string;
  nonce?: string;
  clockToleranceSeconds?: number;
}

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 60;

interface JwksCacheEntry {
  keys: JwksKey[];
  fetchedAt: number;
}

const jwksCache = new Map<string, JwksCacheEntry>();

/** Drops cached JWKS documents. Used by tests and after a kid miss. */
export function resetJwksCache(): void {
  jwksCache.clear();
}

function decodeSegment<T>(segment: string): T {
  const json = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(json) as T;
}

async function fetchJwks(jwksUri: string): Promise<JwksKey[]> {
  const response = await fetch(jwksUri, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `JWKS request failed: ${response.status} ${response.statusText}`,
    );
  }

  const body = (await response.json()) as JwksResponse;
  if (!Array.isArray(body.keys)) {
    throw new Error('JWKS response has no keys');
  }

  jwksCache.set(jwksUri, { keys: body.keys, fetchedAt: Date.now() });
  return body.keys;
}

async function resolveKey(jwksUri: string, kid: string): Promise<JwksKey> {
  const cached = jwksCache.get(jwksUri);
  const isFresh =
    cached !== undefined && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS;

  if (isFresh) {
    const hit = cached.keys.find((key) => key.kid === kid);
    if (hit) {
      return hit;
    }
  }

  const keys = await fetchJwks(jwksUri);
  const key = keys.find((candidate) => candidate.kid === kid);
  if (!key) {
    throw new Error(`No JWKS key matches kid ${kid}`);
  }
  return key;
}

function assertSignature(
  signingInput: string,
  signature: string,
  key: JwksKey,
): void {
  if (key.kty !== 'RSA' || !key.n || !key.e) {
    throw new Error('Unsupported JWKS key type');
  }

  const publicKey = createPublicKey({
    key: { kty: 'RSA', n: key.n, e: key.e },
    format: 'jwk',
  });

  const isValid = verifySignature(
    'sha256',
    Buffer.from(signingInput),
    publicKey,
    Buffer.from(signature, 'base64url'),
  );

  if (!isValid) {
    throw new Error('id_token signature is invalid');
  }
}

function assertClaims(
  claims: IdTokenClaims,
  options: VerifyIdTokenOptions,
): void {
  if (!options.issuers.includes(claims.iss)) {
    throw new Error(`id_token issuer ${claims.iss} is not accepted`);
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(options.audience)) {
    throw new Error('id_token audience does not match the client id');
  }

  const tolerance =
    options.clockToleranceSeconds ?? DEFAULT_CLOCK_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp + tolerance < nowSeconds) {
    throw new Error('id_token has expired');
  }

  if (options.nonce !== undefined && claims.nonce !== options.nonce) {
    throw new Error('id_token nonce does not match');
  }
}

/**
 * Verifies signature, issuer, audience, expiry and nonce of an RS256 id_token.
 *
 * @throws Error when any check fails
 */
export async function verifyIdToken(
  options: VerifyIdTokenOptions,
): Promise<IdTokenClaims> {
  const parts = options.idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('id_token is not a JWS');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const header = decodeSegment<IdTokenHeader>(encodedHeader);

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported id_token algorithm ${header.alg ?? 'none'}`);
  }
  if (!header.kid) {
    throw new Error('id_token header has no kid');
  }

  const key = await resolveKey(options.jwksUri, header.kid);
  assertSignature(`${encodedHeader}.${encodedPayload}`, signature, key);

  const claims = decodeSegment<IdTokenClaims>(encodedPayload);
  assertClaims(claims, options);

  return claims;
}
