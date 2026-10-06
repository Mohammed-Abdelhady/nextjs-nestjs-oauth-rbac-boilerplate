import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from 'node:crypto';
import {
  NATIVE_DPOP_FAILURE_REASON,
  NATIVE_DPOP_IAT_TOLERANCE_MS,
  NATIVE_DPOP_JTI_MAX_LENGTH,
  NATIVE_DPOP_MAX_PROOF_BYTES,
} from '../constants/session-policy';
import { parseNativeDpopJson } from './native-dpop-proof-json';
import { secretEquals } from '../utils/token-hash';

type NativeDpopFailureReason =
  (typeof NATIVE_DPOP_FAILURE_REASON)[keyof typeof NATIVE_DPOP_FAILURE_REASON];

export interface VerifyNativeDpopProofInput {
  proof: string;
  expectedMethod: string;
  expectedAddress: string;
  now: Date;
  expectedNonces: readonly string[];
  token?: string;
}

export type NativeDpopProofResult =
  | { ok: true; thumbprint: string; jti: string }
  | { ok: false; reason: NativeDpopFailureReason };

interface VerifiedKey {
  key: ReturnType<typeof createPublicKey>;
  thumbprint: string;
}

export function verifyNativeDpopProof(
  input: VerifyNativeDpopProofInput,
): NativeDpopProofResult {
  if (Buffer.byteLength(input.proof, 'utf8') > NATIVE_DPOP_MAX_PROOF_BYTES) {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_TOO_LARGE);
  }

  const segments = input.proof.split('.');
  if (
    segments.length !== 3 ||
    segments.some((segment) => segment.length === 0)
  ) {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_MALFORMED);
  }
  const [headerSegment, claimsSegment, signatureSegment] = segments;
  const headerBytes = decodeBase64Url(headerSegment);
  const claimsBytes = decodeBase64Url(claimsSegment);
  const signatureBytes = decodeBase64Url(signatureSegment);
  if (!headerBytes || !claimsBytes || !signatureBytes) {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_MALFORMED);
  }

  const header = parseNativeDpopJson(headerBytes);
  const claims = parseNativeDpopJson(claimsBytes);
  if (!header.ok) {
    return failure(
      header.duplicate
        ? NATIVE_DPOP_FAILURE_REASON.PROOF_DUPLICATE_MEMBER
        : NATIVE_DPOP_FAILURE_REASON.PROOF_MALFORMED,
    );
  }
  if (!claims.ok) {
    return failure(
      claims.duplicate
        ? NATIVE_DPOP_FAILURE_REASON.PROOF_DUPLICATE_MEMBER
        : NATIVE_DPOP_FAILURE_REASON.PROOF_MALFORMED,
    );
  }
  if (header.value.typ !== 'dpop+jwt' || Object.hasOwn(header.value, 'crit')) {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_HEADER_INVALID);
  }
  if (header.value.alg !== 'ES256') {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_ALGORITHM_INVALID);
  }

  const key = readPublicKey(header.value.jwk);
  if (!key) {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_JWK_INVALID);
  }
  if (signatureBytes.length !== 64) {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_SIGNATURE_INVALID);
  }
  if (
    !signatureMatches(headerSegment, claimsSegment, signatureBytes, key.key)
  ) {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_SIGNATURE_INVALID);
  }

  const method = claims.value.htm;
  if (
    typeof method !== 'string' ||
    method.toUpperCase() !== input.expectedMethod.toUpperCase()
  ) {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_METHOD_MISMATCH);
  }
  if (!addressMatches(claims.value.htu, input.expectedAddress)) {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_ADDRESS_MISMATCH);
  }

  const issuedAt = claims.value.iat;
  if (
    typeof issuedAt !== 'number' ||
    !Number.isSafeInteger(issuedAt) ||
    Math.abs(input.now.getTime() - issuedAt * 1000) >
      NATIVE_DPOP_IAT_TOLERANCE_MS
  ) {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_IAT_INVALID);
  }

  const jti = claims.value.jti;
  if (
    typeof jti !== 'string' ||
    jti.trim().length === 0 ||
    [...jti].length > NATIVE_DPOP_JTI_MAX_LENGTH
  ) {
    return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_JTI_INVALID);
  }

  if (!Object.hasOwn(claims.value, 'nonce')) {
    return failure(NATIVE_DPOP_FAILURE_REASON.NONCE_REQUIRED);
  }
  const nonce = claims.value.nonce;
  if (typeof nonce !== 'string' || !matchesOneOf(nonce, input.expectedNonces)) {
    return failure(NATIVE_DPOP_FAILURE_REASON.NONCE_INVALID);
  }

  if (input.token !== undefined) {
    const expectedAth = createHash('sha256')
      .update(input.token)
      .digest('base64url');
    if (
      typeof claims.value.ath !== 'string' ||
      !secretEquals(claims.value.ath, expectedAth)
    ) {
      return failure(NATIVE_DPOP_FAILURE_REASON.PROOF_ATH_INVALID);
    }
  }

  return { ok: true, thumbprint: key.thumbprint, jti };
}

function decodeBase64Url(segment: string): Buffer | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    return undefined;
  }
  const bytes = Buffer.from(segment, 'base64url');
  return bytes.toString('base64url') === segment ? bytes : undefined;
}

function readPublicKey(value: unknown): VerifiedKey | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.hasOwn(value, 'd')
  ) {
    return undefined;
  }
  const kty = Reflect.get(value, 'kty');
  const crv = Reflect.get(value, 'crv');
  const xValue = Reflect.get(value, 'x');
  const yValue = Reflect.get(value, 'y');
  if (kty !== 'EC' || crv !== 'P-256') {
    return undefined;
  }
  if (typeof xValue !== 'string' || typeof yValue !== 'string') {
    return undefined;
  }
  const x = decodeBase64Url(xValue);
  const y = decodeBase64Url(yValue);
  if (!x || !y || x.length !== 32 || y.length !== 32) {
    return undefined;
  }

  try {
    const key = createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: xValue, y: yValue },
      format: 'jwk',
    });
    const canonical = `{"crv":"P-256","kty":"EC","x":"${xValue}","y":"${yValue}"}`;
    const thumbprint = createHash('sha256')
      .update(canonical)
      .digest('base64url');
    return { key, thumbprint };
  } catch {
    return undefined;
  }
}

function signatureMatches(
  header: string,
  claims: string,
  signature: Buffer,
  key: ReturnType<typeof createPublicKey>,
): boolean {
  try {
    return verifySignature(
      'sha256',
      Buffer.from(`${header}.${claims}`),
      { key, dsaEncoding: 'ieee-p1363' },
      signature,
    );
  } catch {
    return false;
  }
}

function normalizedAddress(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  try {
    const address = new URL(value);
    if (
      !['http:', 'https:'].includes(address.protocol) ||
      !address.hostname ||
      address.username ||
      address.password
    ) {
      return undefined;
    }
    return `${address.protocol}//${address.host}${address.pathname}`;
  } catch {
    return undefined;
  }
}

function addressMatches(actual: unknown, expected: string): boolean {
  const normalizedActual = normalizedAddress(actual);
  const normalizedExpected = normalizedAddress(expected);
  return (
    normalizedActual !== undefined &&
    normalizedExpected !== undefined &&
    normalizedActual === normalizedExpected
  );
}

function matchesOneOf(
  value: string,
  expectedValues: readonly string[],
): boolean {
  let matched = false;
  for (const expected of expectedValues) {
    const candidateMatched = secretEquals(value, expected);
    matched = candidateMatched || matched;
  }
  return matched;
}

function failure(reason: NativeDpopFailureReason): NativeDpopProofResult {
  return { ok: false, reason };
}
