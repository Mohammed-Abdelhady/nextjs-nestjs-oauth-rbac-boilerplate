import { SignJWT, importPKCS8 } from 'jose';

/**
 * Apple has no static client secret. The token endpoint expects an ES256 JWT
 * signed with the .p8 sign-in key, so one is built per token exchange.
 */

export interface AppleClientSecretInput {
  /** Apple Developer team id, the `iss` claim. */
  teamId: string;
  /** Identifier of the .p8 key, the `kid` header. */
  keyId: string;
  /** PEM contents of the .p8 key. Newlines may be written as \n. */
  privateKey: string;
  /** Services ID, the `sub` claim. */
  clientId: string;
  /** Lifetime of the secret. Clamped to Apple's six month ceiling. */
  expiresInSeconds?: number;
}

export const APPLE_AUDIENCE = 'https://appleid.apple.com';

/** Longest lifetime Apple accepts for a client secret, six months. */
export const APPLE_CLIENT_SECRET_MAX_LIFETIME_SECONDS = 15777000;

/** The secret is used once, right away, so it does not need to outlive the request. */
const DEFAULT_LIFETIME_SECONDS = 300;

/** Environment variables cannot hold real newlines, so PEMs arrive escaped. */
export function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, '\n').trim();
}

/**
 * @throws Error when the key is not a usable PKCS#8 ES256 key
 */
export async function createAppleClientSecret(
  input: AppleClientSecretInput,
): Promise<string> {
  const key = await importPKCS8(normalizePrivateKey(input.privateKey), 'ES256');

  const lifetime = Math.min(
    input.expiresInSeconds ?? DEFAULT_LIFETIME_SECONDS,
    APPLE_CLIENT_SECRET_MAX_LIFETIME_SECONDS,
  );
  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: input.keyId })
    .setIssuer(input.teamId)
    .setSubject(input.clientId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + lifetime)
    .sign(key);
}
