import {
  DPOP_TEST_NONCE,
  DPOP_TEST_PRIVATE_KEY_A,
  DPOP_TEST_PUBLIC_KEY_A,
  signNativeDpopProof,
} from './native-dpop-test-vectors.harness-spec';
import { verifyNativeDpopProof } from './native-dpop-proof';
import { TEST_NOW } from '../../../test/utils/frozen-clock';

const PREVIOUS_NONCE = '67849199.Ne0NwRUyXUmj54_D4fUuuqF5n1Bb28oUT1RzrXBCtjU';
const TOKEN_ADDRESS = 'https://api.example.test/api/oauth/token';

function verify(proof: string) {
  return verifyNativeDpopProof({
    proof,
    expectedMethod: 'POST',
    expectedAddress: TOKEN_ADDRESS,
    now: TEST_NOW,
    expectedNonces: [DPOP_TEST_NONCE, PREVIOUS_NONCE],
  });
}

describe('Native DPoP proof structure', () => {
  it.each([
    ['missing separator', 'compact'],
    ['empty segments', '..'],
    ['empty signature', 'e30.e30.'],
    ['empty payload', 'e30..c2ln'],
    ['extra segment', 'e30.e30.c2ln.extra'],
    ['invalid base64url', '@@.@@.@@'],
    ['padded base64url', 'e30=.e30=.c2ln'],
  ])('rejects %s', (_label, proof) => {
    expect(verify(proof)).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_MALFORMED',
    });
  });

  it('rejects a proof that exceeds the byte limit before parsing', () => {
    expect(verify('x'.repeat(8193))).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_TOO_LARGE',
    });
  });

  it.each([
    ['bad header JSON', '{"typ":'],
    ['bad payload JSON', '{"htm":'],
  ])('rejects %s', (_label, json) => {
    const proof =
      _label === 'bad header JSON'
        ? signNativeDpopProof({ headerJson: json })
        : signNativeDpopProof({ payloadJson: json });

    expect(verify(proof)).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_MALFORMED',
    });
  });

  it('rejects duplicate header and claim members', () => {
    const jwk = JSON.stringify(DPOP_TEST_PUBLIC_KEY_A);
    const duplicateHeader = signNativeDpopProof({
      headerJson: `{"typ":"dpop+jwt","typ":"dpop+jwt","alg":"ES256","jwk":${jwk}}`,
    });
    const duplicateClaims = signNativeDpopProof({
      payloadJson:
        '{"htm":"POST","htu":"https://api.example.test/api/oauth/token","iat":4070952000,"jti":"id","jti":"id","nonce":"' +
        DPOP_TEST_NONCE +
        '"}',
    });

    expect(verify(duplicateHeader)).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_DUPLICATE_MEMBER',
    });
    expect(verify(duplicateClaims)).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_DUPLICATE_MEMBER',
    });
  });

  it.each([
    ['missing typ', { typ: undefined }],
    ['wrong typ', { typ: 'JWT' }],
    ['critical header', { crit: [] }],
  ])('rejects %s', (_label, header) => {
    expect(verify(signNativeDpopProof({ header }))).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_HEADER_INVALID',
    });
  });

  it.each([
    ['none', 'none'],
    ['RSA', 'RS256'],
    ['HMAC', 'HS256'],
  ])('rejects algorithm %s', (_label, alg) => {
    expect(verify(signNativeDpopProof({ header: { alg } }))).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_ALGORITHM_INVALID',
    });
  });

  it.each([
    ['wrong curve', { crv: 'P-384' }],
    ['short x coordinate', { x: 'AQ' }],
    ['short y coordinate', { y: 'AQ' }],
  ])('rejects JWK with %s', (_label, jwkChange) => {
    const publicJwk = { ...DPOP_TEST_PUBLIC_KEY_A, ...jwkChange };

    expect(verify(signNativeDpopProof({ publicJwk }))).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_JWK_INVALID',
    });
  });

  it('rejects a complete private P-256 JWK', () => {
    expect(
      verify(signNativeDpopProof({ publicJwk: DPOP_TEST_PRIVATE_KEY_A })),
    ).toEqual({ ok: false, reason: 'NATIVE_DPOP_PROOF_JWK_INVALID' });
  });

  it.each([63, 65])('rejects a %i-byte signature', (signatureLength) => {
    expect(verify(signNativeDpopProof({ signatureLength }))).toEqual({
      ok: false,
      reason: 'NATIVE_DPOP_PROOF_SIGNATURE_INVALID',
    });
  });
});
