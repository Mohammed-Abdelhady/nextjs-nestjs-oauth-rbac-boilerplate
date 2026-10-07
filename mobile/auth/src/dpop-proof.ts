import {
  CRYPTO_DIGEST_TIMEOUT_MS,
  DPOP_JTI_BYTES,
  DEVICE_KEY_TIMEOUT_MS,
  PORT_OPERATION,
} from './constants';
import { withPortDeadline } from './deadlines';
import { DeviceKeyAuthError } from './errors';
import { base64UrlEncode, utf8Bytes } from './encoding';
import type {
  ClockPort,
  CryptoPort,
  DeviceKeyPort,
  DeviceKeyResult,
  Es256PublicJwk,
  TimerPort,
} from './types/auth';

export interface DpopProofDependencies {
  crypto: CryptoPort;
  clock: ClockPort;
  timer: TimerPort;
  deviceKey?: DeviceKeyPort;
}

export interface DpopProofInput extends DpopProofDependencies {
  serverBaseAddress: string;
  method: string;
  path: string;
  token?: string;
  nonce?: string;
  expectedThumbprint?: string;
}

export interface DpopProof {
  proof: string;
  thumbprint: string;
}

export async function deviceKeyThumbprint(dependencies: DpopProofDependencies): Promise<string> {
  const key = await readPublicKey(dependencies);
  return thumbprintOf(key, dependencies);
}

export async function buildDpopProof(input: DpopProofInput): Promise<DpopProof> {
  const key = await readPublicKey(input);
  const thumbprint = await thumbprintOf(key, input);
  if (input.expectedThumbprint !== undefined && thumbprint !== input.expectedThumbprint) {
    throw new DeviceKeyAuthError('thumbprintMismatch');
  }
  const jtiBytes = await withPortDeadline(
    input.timer,
    DEVICE_KEY_TIMEOUT_MS,
    () => input.crypto.randomBytes(DPOP_JTI_BYTES),
    PORT_OPERATION.CRYPTO_RANDOM_BYTES,
  );
  if (jtiBytes.length !== DPOP_JTI_BYTES) {
    throw new TypeError('The crypto port returned the wrong DPoP id length');
  }
  const wallTime = input.clock.wallTime();
  if (!Number.isFinite(wallTime)) throw new TypeError('The wall clock must return a finite number');
  const header = {
    typ: 'dpop+jwt',
    alg: 'ES256',
    jwk: {
      kty: key.kty,
      crv: key.crv,
      x: key.x,
      y: key.y,
      alg: key.alg,
    },
  };
  const payload = {
    htm: input.method.toUpperCase(),
    htu: requestAddress(input.serverBaseAddress, input.path),
    iat: Math.floor(wallTime / 1000),
    jti: base64UrlEncode(jtiBytes),
    nonce: input.nonce ?? '',
    ...(input.token === undefined ? {} : { ath: await tokenHash(input, input.token) }),
  };
  const signingInput = `${base64UrlEncode(utf8Bytes(JSON.stringify(header)))}.${base64UrlEncode(
    utf8Bytes(JSON.stringify(payload)),
  )}`;
  const signature = await sign(input, utf8Bytes(signingInput));
  if (signature.length !== 64) throw new DeviceKeyAuthError('keyInvalidated');
  return {
    proof: `${signingInput}.${base64UrlEncode(signature)}`,
    thumbprint,
  };
}

async function readPublicKey(dependencies: DpopProofDependencies): Promise<Es256PublicJwk> {
  const deviceKey = dependencies.deviceKey;
  if (!deviceKey) throw new DeviceKeyAuthError('unavailable');
  let result: DeviceKeyResult<Es256PublicJwk>;
  try {
    result = await withPortDeadline(
      dependencies.timer,
      DEVICE_KEY_TIMEOUT_MS,
      () => deviceKey.publicKey(),
      PORT_OPERATION.DEVICE_KEY_PUBLIC_KEY,
    );
  } catch (error) {
    throw new DeviceKeyAuthError('unavailable', error);
  }
  if (result.kind !== 'success') throw new DeviceKeyAuthError(result.kind);
  const key = result.value;
  if (
    key.kty !== 'EC' ||
    key.crv !== 'P-256' ||
    key.alg !== 'ES256' ||
    !/^[A-Za-z0-9_-]{43}$/.test(key.x) ||
    !/^[A-Za-z0-9_-]{43}$/.test(key.y)
  ) {
    throw new DeviceKeyAuthError('keyInvalidated');
  }
  return key;
}

async function thumbprintOf(
  key: Es256PublicJwk,
  dependencies: DpopProofDependencies,
): Promise<string> {
  const canonical = JSON.stringify({ crv: key.crv, kty: key.kty, x: key.x, y: key.y });
  const digest = await withPortDeadline(
    dependencies.timer,
    CRYPTO_DIGEST_TIMEOUT_MS,
    () => dependencies.crypto.sha256(utf8Bytes(canonical)),
    PORT_OPERATION.CRYPTO_SHA256,
  );
  if (digest.length !== 32) throw new TypeError('SHA-256 must return 32 bytes');
  return base64UrlEncode(digest);
}

async function tokenHash(input: DpopProofInput, token: string): Promise<string> {
  const digest = await withPortDeadline(
    input.timer,
    CRYPTO_DIGEST_TIMEOUT_MS,
    () => input.crypto.sha256(utf8Bytes(token)),
    PORT_OPERATION.CRYPTO_SHA256,
  );
  if (digest.length !== 32) throw new TypeError('SHA-256 must return 32 bytes');
  return base64UrlEncode(digest);
}

async function sign(input: DpopProofInput, data: Uint8Array): Promise<Uint8Array> {
  const deviceKey = input.deviceKey;
  if (!deviceKey) throw new DeviceKeyAuthError('unavailable');
  let result: DeviceKeyResult<Uint8Array>;
  try {
    result = await withPortDeadline(
      input.timer,
      DEVICE_KEY_TIMEOUT_MS,
      () => deviceKey.sign(data),
      PORT_OPERATION.DEVICE_KEY_SIGN,
    );
  } catch (error) {
    throw new DeviceKeyAuthError('unavailable', error);
  }
  if (result.kind !== 'success') throw new DeviceKeyAuthError(result.kind);
  return result.value;
}

function requestAddress(serverBaseAddress: string, path: string): string {
  const schemeEnd = serverBaseAddress.indexOf('://');
  if (schemeEnd < 0) throw new TypeError('The server base address is invalid');
  const authorityEnd = serverBaseAddress.indexOf('/', schemeEnd + 3);
  const origin = authorityEnd < 0 ? serverBaseAddress : serverBaseAddress.slice(0, authorityEnd);
  const prefix = authorityEnd < 0 ? '' : serverBaseAddress.slice(authorityEnd).replace(/\/+$/, '');
  const pathEnd = path.search(/[?#]/);
  const requestPath = pathEnd < 0 ? path : path.slice(0, pathEnd);
  return `${origin}${prefix}${requestPath}`;
}
