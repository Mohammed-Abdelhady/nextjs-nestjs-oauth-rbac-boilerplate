import { WebAuthnAdapter } from './webauthn.adapter';
import {
  CREDENTIAL_BODY,
  CREDENTIAL_ID,
  ORIGIN,
  RP_ID,
} from '../passkeys.harness-spec';

/**
 * The one spec that runs the real library rather than a mock of it.
 *
 * A credential that would pass the check has to be signed by an authenticator,
 * which cannot be produced here, so what this pins down is the other half: the
 * library reports a bad signature as `verified: false` but throws for a
 * mismatched challenge, origin or RP id and for a payload it cannot parse. Both
 * have to leave the adapter as null, or a malformed request would reach the
 * client as a 500 instead of the 401 the routes promise.
 */

const EXPECTED = { challenge: 'challenge', origin: ORIGIN, rpId: RP_ID };

const STORED = {
  id: CREDENTIAL_ID,
  publicKey: Buffer.from([1, 2, 3]),
  counter: 0,
  transports: ['internal'],
};

describe('WebAuthnAdapter', () => {
  const adapter = new WebAuthnAdapter();

  it('should build registration options for the configured relying party', async () => {
    const options = await adapter.createRegistrationOptions({
      rpId: RP_ID,
      rpName: 'Test App',
      userId: '507f1f77bcf86cd799439011',
      userName: 'user@example.com',
      userDisplayName: 'Test User',
      excludeCredentials: [{ id: CREDENTIAL_ID, transports: ['internal'] }],
    });

    expect(options.rp).toEqual({ id: RP_ID, name: 'Test App' });
    expect(typeof options.challenge).toBe('string');
    expect(options.excludeCredentials).toEqual([
      { id: CREDENTIAL_ID, type: 'public-key', transports: ['internal'] },
    ]);
    expect(options.authenticatorSelection?.residentKey).toBe('preferred');
    expect(options.authenticatorSelection?.userVerification).toBe('preferred');
  });

  it('should build sign-in options with no credentials to choose from', async () => {
    const options = await adapter.createAuthenticationOptions({
      rpId: RP_ID,
      allowCredentials: [],
    });

    expect(options.rpId).toBe(RP_ID);
    expect(typeof options.challenge).toBe('string');
    expect(options.allowCredentials).toEqual([]);
  });

  it('should report an unreadable attestation as a refusal, not an error', async () => {
    await expect(
      adapter.verifyAttestation(CREDENTIAL_BODY, EXPECTED),
    ).resolves.toBeNull();
  });

  it('should report an unreadable assertion as a refusal, not an error', async () => {
    await expect(
      adapter.verifyAssertion(CREDENTIAL_BODY, STORED, EXPECTED),
    ).resolves.toBeNull();
  });

  it('should refuse an assertion whose client data is not JSON', async () => {
    const credential = {
      ...CREDENTIAL_BODY,
      response: {
        clientDataJSON: Buffer.from('not json').toString('base64url'),
        authenticatorData: 'AAAA',
        signature: 'AAAA',
      },
    };

    await expect(
      adapter.verifyAssertion(credential, STORED, EXPECTED),
    ).resolves.toBeNull();
  });

  it('should refuse an assertion that answers a different challenge', async () => {
    const clientData = {
      type: 'webauthn.get',
      challenge: 'some-other-challenge',
      origin: ORIGIN,
    };
    const credential = {
      ...CREDENTIAL_BODY,
      response: {
        clientDataJSON: Buffer.from(JSON.stringify(clientData)).toString(
          'base64url',
        ),
        authenticatorData: 'AAAA',
        signature: 'AAAA',
      },
    };

    await expect(
      adapter.verifyAssertion(credential, STORED, EXPECTED),
    ).resolves.toBeNull();
  });

  it('should refuse an assertion that came from another origin', async () => {
    const clientData = {
      type: 'webauthn.get',
      challenge: 'challenge',
      origin: 'https://evil.example.com',
    };
    const credential = {
      ...CREDENTIAL_BODY,
      response: {
        clientDataJSON: Buffer.from(JSON.stringify(clientData)).toString(
          'base64url',
        ),
        authenticatorData: 'AAAA',
        signature: 'AAAA',
      },
    };

    await expect(
      adapter.verifyAssertion(credential, STORED, EXPECTED),
    ).resolves.toBeNull();
  });
});
