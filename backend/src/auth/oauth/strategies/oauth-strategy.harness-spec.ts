import { ConfigService } from '@nestjs/config';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import type { CryptoKey, JSONWebKeySet, JWTPayload } from 'jose';
import { OAuthProviderConfig } from '../../../config/oauth.config';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { resetJwksCache } from '../utils/id-token.util';

/**
 * Shared setup for the provider strategy specs: a fake ConfigService, a signing
 * key whose public half is served as a JWKS document, and a fetch mock that
 * routes by URL. Nothing here is a test suite; the file name keeps it out of
 * jest's testRegex.
 */

export const TEST_KID = 'test-signing-key';

export interface SigningKey {
  privateKey: CryptoKey;
  jwks: JSONWebKeySet;
}

/** RS256 key pair with the public half shaped as a one entry JWKS document. */
export async function createSigningKey(
  alg = 'RS256',
  kid = TEST_KID,
): Promise<SigningKey> {
  const { privateKey, publicKey } = await generateKeyPair(alg, {
    extractable: true,
  });
  const jwk = await exportJWK(publicKey);

  return {
    privateKey,
    jwks: { keys: [{ ...jwk, kid, alg, use: 'sig' }] },
  };
}

export interface IdTokenOptions {
  key: SigningKey;
  claims: JWTPayload;
  alg?: string;
  kid?: string;
  expiresInSeconds?: number;
}

export async function signIdToken(options: IdTokenOptions): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT(options.claims)
    .setProtectedHeader({
      alg: options.alg ?? 'RS256',
      kid: options.kid ?? TEST_KID,
    })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + (options.expiresInSeconds ?? 600))
    .sign(options.key.privateKey);
}

export interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, string>;
}

export interface FetchRoute {
  /** Matched against the start of the request URL. */
  url: string;
  status?: number;
  body: unknown;
}

export interface FetchMock {
  calls: FetchCall[];
  /** Single call to a URL that starts with the given prefix. */
  callTo(urlPrefix: string): FetchCall;
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

function parseBody(init?: RequestInit): Record<string, string> {
  if (typeof init?.body !== 'string') {
    return {};
  }
  return Object.fromEntries(new URLSearchParams(init.body));
}

function parseHeaders(init?: RequestInit): Record<string, string> {
  const headers = init?.headers;
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return {};
  }
  return { ...(headers as Record<string, string>) };
}

/**
 * Replaces global.fetch with a router over `routes`. An unmatched URL fails the
 * test rather than reaching the network.
 */
export function mockFetch(routes: FetchRoute[]): FetchMock {
  const calls: FetchCall[] = [];

  const fetchMock = jest.fn(
    (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = requestUrl(input);
      calls.push({
        url,
        method: init?.method ?? 'GET',
        headers: parseHeaders(init),
        body: parseBody(init),
      });

      const route = routes.find((candidate) => url.startsWith(candidate.url));
      if (!route) {
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      }

      const status = route.status ?? 200;
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        statusText: `status ${status}`,
        json: () => Promise.resolve(route.body),
      } as Response);
    },
  );

  global.fetch = fetchMock as unknown as typeof fetch;
  resetJwksCache();

  return {
    calls,
    callTo(urlPrefix: string): FetchCall {
      const call = calls.find((candidate) =>
        candidate.url.startsWith(urlPrefix),
      );
      if (!call) {
        throw new Error(`No fetch call to ${urlPrefix}`);
      }
      return call;
    },
  };
}

/**
 * Asserts that a strategy call rejects with a given error code.
 *
 * @throws Error when the call resolves instead
 */
export async function expectAppException(
  call: Promise<unknown>,
  code: ErrorCode,
): Promise<AppException> {
  try {
    await call;
  } catch (error) {
    const exception = error as AppException;
    expect(exception).toBeInstanceOf(AppException);
    expect(exception.getCode()).toBe(code);
    return exception;
  }
  throw new Error(`expected the call to reject with ${code}`);
}

/** ConfigService that only answers `oauth.providers.<id>`. */
export function configFor(
  providerId: string,
  config: Partial<OAuthProviderConfig>,
): ConfigService {
  const values: Record<string, unknown> = {
    [`oauth.providers.${providerId}`]: {
      enabled: true,
      extra: {},
      ...config,
    },
  };

  return {
    get: <T>(key: string, fallback?: T): T | undefined =>
      (values[key] as T | undefined) ?? fallback,
  } as unknown as ConfigService;
}
