import { TEST_NOW } from '../../../test/utils/frozen-clock';
import {
  DPOP_TEST_ADDRESS,
  DPOP_TEST_NONCE,
  DPOP_TEST_PUBLIC_KEY_B,
  signNativeDpopProof,
} from './native-dpop-test-vectors.harness-spec';
import { verifyNativeDpopProof } from './native-dpop-proof';

const PREVIOUS_NONCE = '67849199.Ne0NwRUyXUmj54_D4fUuuqF5n1Bb28oUT1RzrXBCtjU';
const THUMBPRINT_A = 'cCnUK5OVvBfWAvjwdXAKfKdQaxTaqMdT7QNXypbdj6E';
const TOKEN_ADDRESS = 'https://api.example.test/api/oauth/token';

function verify(
  proof: string,
  options: { expectedAddress?: string; token?: string } = {},
) {
  return verifyNativeDpopProof({
    proof,
    expectedMethod: 'POST',
    expectedAddress: options.expectedAddress ?? DPOP_TEST_ADDRESS,
    now: TEST_NOW,
    expectedNonces: [DPOP_TEST_NONCE, PREVIOUS_NONCE],
    ...(options.token === undefined ? {} : { token: options.token }),
  });
}

describe('verifyNativeDpopProof', () => {
  it('returns the independently calculated P-256 thumbprint and proof id', () => {
    expect(verify(signNativeDpopProof())).toEqual({
      ok: true,
      thumbprint: THUMBPRINT_A,
      jti: 'dpop-test-proof-id',
    });
  });

  it('normalizes scheme and host and ignores query and fragment', () => {
    const proof = signNativeDpopProof({
      claims: {
        htu: 'https://API.EXAMPLE.TEST:443/api/oauth/token?code=abc#fragment',
      },
    });

    expect(verify(proof, { expectedAddress: TOKEN_ADDRESS })).toMatchObject({
      ok: true,
      thumbprint: THUMBPRINT_A,
    });
  });

  it.each([
    ['wrong method', { htm: 'GET' }, 'NATIVE_DPOP_PROOF_METHOD_MISMATCH'],
    [
      'wrong scheme',
      { htu: 'http://api.example.test/api/oauth/token' },
      'NATIVE_DPOP_PROOF_ADDRESS_MISMATCH',
    ],
    [
      'wrong host',
      { htu: 'https://forged.example/api/oauth/token' },
      'NATIVE_DPOP_PROOF_ADDRESS_MISMATCH',
    ],
    [
      'trailing slash',
      { htu: 'https://api.example.test/api/oauth/token/' },
      'NATIVE_DPOP_PROOF_ADDRESS_MISMATCH',
    ],
  ])('rejects %s', (_name, claims, reason) => {
    expect(verify(signNativeDpopProof({ claims }))).toEqual({
      ok: false,
      reason,
    });
  });

  it.each([
    ['plus 60 seconds', 4070952060, true],
    ['minus 60 seconds', 4070951940, true],
    ['plus 61 seconds', 4070952061, false],
    ['minus 61 seconds', 4070951939, false],
  ])('handles iat at %s', (_name, iat, accepted) => {
    const result = verify(signNativeDpopProof({ claims: { iat } }));

    expect(result).toEqual(
      accepted
        ? { ok: true, thumbprint: THUMBPRINT_A, jti: 'dpop-test-proof-id' }
        : { ok: false, reason: 'NATIVE_DPOP_PROOF_IAT_INVALID' },
    );
  });

  it.each([
    ['fractional iat', 4070952000.5],
    ['string iat', '4070952000'],
  ])('rejects %s', (_name, iat) => {
    expect(verify(signNativeDpopProof({ claims: { iat } }))).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_IAT_INVALID',
    });
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['over 128 characters', 'j'.repeat(129)],
    ['non-string', 7],
  ])('rejects %s jti', (_name, jti) => {
    expect(verify(signNativeDpopProof({ claims: { jti } }))).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_JTI_INVALID',
    });
  });

  it('accepts a 128-character jti and the previous bucket nonce', () => {
    const jti = 'j'.repeat(128);
    const proof = signNativeDpopProof({
      claims: { jti, nonce: PREVIOUS_NONCE },
    });

    expect(verify(proof)).toMatchObject({
      ok: true,
      thumbprint: THUMBPRINT_A,
    });
  });

  it.each([
    ['missing nonce', undefined, 'NATIVE_DPOP_NONCE_REQUIRED'],
    ['forged nonce', 'forged-nonce', 'NATIVE_DPOP_NONCE_INVALID'],
  ])('rejects a %s', (_label, nonce, reason) => {
    expect(verify(signNativeDpopProof({ claims: { nonce } }))).toEqual({
      ok: false,
      reason,
    });
  });

  it('requires ath when a token is supplied and checks its SHA-256 digest', () => {
    const token = 'opaque-native-token';
    const proof = signNativeDpopProof({ token });

    expect(verify(proof, { token })).toEqual({
      ok: true,
      thumbprint: THUMBPRINT_A,
      jti: 'dpop-test-proof-id',
    });
    expect(
      verify(signNativeDpopProof({ claims: { ath: 'forged' } }), { token }),
    ).toEqual({ ok: false, reason: 'NATIVE_DPOP_PROOF_ATH_INVALID' });
    expect(
      verify(signNativeDpopProof({ claims: { ath: undefined } }), { token }),
    ).toEqual({ ok: false, reason: 'NATIVE_DPOP_PROOF_ATH_INVALID' });
  });

  it('rejects a key A signature that carries key B', () => {
    expect(
      verify(
        signNativeDpopProof({
          publicJwk: DPOP_TEST_PUBLIC_KEY_B,
          signingKey: 'A',
        }),
      ),
    ).toEqual({ ok: false, reason: 'NATIVE_DPOP_PROOF_SIGNATURE_INVALID' });
  });

  it('rejects a bad signature', () => {
    const signed = signNativeDpopProof();
    const [header, payload, signature] = signed.split('.');
    const bytes = Buffer.from(signature, 'base64url');
    bytes[0] = bytes[0] ^ 1;

    expect(
      verify(`${header}.${payload}.${bytes.toString('base64url')}`),
    ).toEqual({ ok: false, reason: 'NATIVE_DPOP_PROOF_SIGNATURE_INVALID' });
  });

  it('rejects claims changed after the signature was created', () => {
    const [header, payload, signature] = signNativeDpopProof().split('.');
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as {
      jti: string;
    };
    claims.jti = 'changed-after-signing';
    const changedPayload = Buffer.from(JSON.stringify(claims)).toString(
      'base64url',
    );

    expect(verify(`${header}.${changedPayload}.${signature}`)).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_SIGNATURE_INVALID',
    });
  });
});
