import { decodeJwt, exportJWK, exportPKCS8, generateKeyPair } from 'jose';
import type { CryptoKey } from 'jose';
import {
  APPLE_AUDIENCE,
  APPLE_CLIENT_SECRET_MAX_LIFETIME_SECONDS,
  createAppleClientSecret,
  normalizePrivateKey,
} from './apple-client-secret.util';

const TEAM_ID = 'ABCDE12345';
const KEY_ID = 'KEY1234567';
const CLIENT_ID = 'com.example.service';

describe('normalizePrivateKey', () => {
  it('turns escaped newlines into real ones', () => {
    const pem = normalizePrivateKey(
      '-----BEGIN PRIVATE KEY-----\\nMIGT\\n-----END PRIVATE KEY-----\\n',
    );

    expect(pem).toBe(
      '-----BEGIN PRIVATE KEY-----\nMIGT\n-----END PRIVATE KEY-----',
    );
  });

  it('leaves a PEM with real newlines alone', () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nMIGT\n-----END PRIVATE KEY-----';

    expect(normalizePrivateKey(pem)).toBe(pem);
  });
});

describe('createAppleClientSecret', () => {
  let privateKey: CryptoKey;
  let pem: string;

  beforeAll(async () => {
    const pair = await generateKeyPair('ES256', { extractable: true });
    privateKey = pair.privateKey;
    pem = await exportPKCS8(privateKey);
    // Touch the public half so a failure here points at key generation.
    expect(await exportJWK(pair.publicKey)).toHaveProperty('crv', 'P-256');
  });

  it('claims the team as issuer and the Services ID as subject', async () => {
    const secret = await createAppleClientSecret({
      teamId: TEAM_ID,
      keyId: KEY_ID,
      privateKey: pem,
      clientId: CLIENT_ID,
    });

    const claims = decodeJwt(secret);
    expect(claims.iss).toBe(TEAM_ID);
    expect(claims.sub).toBe(CLIENT_ID);
    expect(claims.aud).toBe(APPLE_AUDIENCE);
  });

  it('accepts a PEM whose newlines are escaped', async () => {
    const secret = await createAppleClientSecret({
      teamId: TEAM_ID,
      keyId: KEY_ID,
      privateKey: pem.replace(/\n/g, '\\n'),
      clientId: CLIENT_ID,
    });

    expect(decodeJwt(secret).sub).toBe(CLIENT_ID);
  });

  it('clamps the lifetime to the six month ceiling Apple allows', async () => {
    const secret = await createAppleClientSecret({
      teamId: TEAM_ID,
      keyId: KEY_ID,
      privateKey: pem,
      clientId: CLIENT_ID,
      expiresInSeconds: APPLE_CLIENT_SECRET_MAX_LIFETIME_SECONDS * 2,
    });

    const claims = decodeJwt(secret);
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(
      APPLE_CLIENT_SECRET_MAX_LIFETIME_SECONDS,
    );
  });

  it('defaults to a secret that outlives only the token request', async () => {
    const secret = await createAppleClientSecret({
      teamId: TEAM_ID,
      keyId: KEY_ID,
      privateKey: pem,
      clientId: CLIENT_ID,
    });

    const claims = decodeJwt(secret);
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(300);
  });

  it('rejects a key that is not a PKCS#8 PEM', async () => {
    await expect(
      createAppleClientSecret({
        teamId: TEAM_ID,
        keyId: KEY_ID,
        privateKey: 'not-a-key',
        clientId: CLIENT_ID,
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});
