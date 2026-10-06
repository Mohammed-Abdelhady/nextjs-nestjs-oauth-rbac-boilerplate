import { createHash } from 'crypto';
import { createAuthEngine } from '@app/native-auth';
import type {
  AbortSignalPort,
  AuthBrowserResult,
  AuthDependencies,
  AuthEngine,
  ClockPort,
  TimerPort,
} from '@app/native-auth';
import { TransportError, TRANSPORT_FAILURE } from '@app/sdk';
import type { TransportRequest, TransportResponse } from '@app/sdk';
import request from 'supertest';
import { loginAs, type E2eApp, type TestAgent } from './e2e-app';
import { SEED_USER } from '../constants/seed-users';
import { supertestTransport } from './sdk-transport';
import { NATIVE_CLIENT_ID, NATIVE_REDIRECT } from './native-authorize.fixtures';

const CONFIG = {
  serverBaseAddress: 'http://127.0.0.1:5107',
  environment: 'test',
  clientId: NATIVE_CLIENT_ID,
  redirectUri: NATIVE_REDIRECT,
  scopes: ['api'],
};

export type EnginePorts = AuthDependencies & {
  clock: ClockPort & { elapsed: number; advance(milliseconds: number): void };
  beforeTransportRequest?: (request: TransportRequest<AbortSignalPort>) => void;
  loseNextRefreshResponse(): void;
};

export interface EngineHarness {
  engine: AuthEngine;
  ports: EnginePorts;
  requests: TransportRequest<AbortSignalPort>[];
  responses: TransportResponse[];
  authorizationAddresses: string[];
}

export async function openEngine(
  e2eApp: E2eApp,
  redirectUri = CONFIG.redirectUri,
  authorizationChoice: 'approve' | 'deny' = 'approve',
): Promise<EngineHarness> {
  const browser = await loginAs(e2eApp.httpServer, SEED_USER);
  const requests: TransportRequest<AbortSignalPort>[] = [];
  const responses: TransportResponse[] = [];
  const authorizationAddresses: string[] = [];
  const ports = makePorts(
    browser,
    e2eApp,
    requests,
    responses,
    authorizationAddresses,
    authorizationChoice,
  );
  const engine = createAuthEngine({ ...CONFIG, redirectUri }, ports);
  await engine.restore();
  return { engine, ports, requests, responses, authorizationAddresses };
}

export async function signedInEngine(e2eApp: E2eApp): Promise<EngineHarness> {
  const harness = await openEngine(e2eApp);
  const outcome = await harness.engine.signIn();
  if (outcome.kind !== 'signedIn')
    throw new Error(`Sign in failed: ${outcome.kind}`);
  return harness;
}

export function refreshTokenRequests(
  requests: TransportRequest<AbortSignalPort>[],
) {
  return requests.filter(
    ({ path, body }) => path === '/api/oauth/token' && isRefreshBody(body),
  );
}

export function isRefreshBody(
  value: unknown,
): value is { grant_type: string; refresh_token: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'grant_type' in value &&
    value.grant_type === 'refresh_token' &&
    'refresh_token' in value &&
    typeof value.refresh_token === 'string'
  );
}

function makePorts(
  browser: TestAgent,
  e2eApp: E2eApp,
  requests: TransportRequest<AbortSignalPort>[],
  responses: TransportResponse[],
  authorizationAddresses: string[],
  authorizationChoice: 'approve' | 'deny',
): EnginePorts {
  let credential: string | undefined;
  let loseRefreshResponse = false;
  const rawTransport = supertestTransport(() => request(e2eApp.httpServer));
  const clock: ClockPort & {
    elapsed: number;
    advance(milliseconds: number): void;
  } = {
    elapsed: 1000,
    advance(milliseconds) {
      this.elapsed += milliseconds;
    },
    wallTime: () => e2eApp.clock.now().getTime(),
    monotonicTime() {
      return this.elapsed;
    },
  };
  let randomCall = 0;
  const ports: EnginePorts = {
    credentials: {
      read: () =>
        Promise.resolve(
          credential === undefined
            ? { kind: 'missing' }
            : { kind: 'found', value: credential },
        ),
      replace: (value: string) => {
        credential = value;
        return Promise.resolve();
      },
      delete: () => {
        credential = undefined;
        return Promise.resolve();
      },
    },
    authBrowser: {
      open: async (address: string, _signal: AbortSignalPort) => {
        authorizationAddresses.push(address);
        return authorizeWithBrowser(browser, address, authorizationChoice);
      },
    },
    crypto: {
      randomBytes: (length: number) => {
        randomCall += 1;
        return Promise.resolve(new Uint8Array(length).fill(randomCall));
      },
      sha256: (bytes: Uint8Array) =>
        Promise.resolve(
          Uint8Array.from(createHash('sha256').update(bytes).digest()),
        ),
    },
    callbacks: {
      subscribe: () => () => undefined,
      initialAddress: () => Promise.resolve(undefined),
    },
    clock,
    timer: new TestTimer(),
    install: {
      identity: () => Promise.resolve({ kind: 'found', id: 'e2e-install' }),
    },
    loseNextRefreshResponse: () => {
      loseRefreshResponse = true;
    },
    makeTransport: (_baseAddress: string) => ({
      request: async (
        transportRequest: TransportRequest<AbortSignalPort>,
      ): Promise<TransportResponse> => {
        ports.beforeTransportRequest?.(transportRequest);
        requests.push(transportRequest);
        const response = await rawTransport.request(transportRequest);
        responses.push(response);
        if (
          loseRefreshResponse &&
          isRefreshBody(transportRequest.body) &&
          response.status >= 200 &&
          response.status < 300
        ) {
          loseRefreshResponse = false;
          throw new TransportError(TRANSPORT_FAILURE.NO_RESPONSE);
        }
        return response;
      },
    }),
  };
  return ports;
}

class TestTimer implements TimerPort {
  private nextId = 0;
  private callbacks = new Map<number, () => void>();

  after(_milliseconds: number, callback: () => void): () => void {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return () => this.callbacks.delete(id);
  }
}

async function authorizeWithBrowser(
  browser: TestAgent,
  address: string,
  choice: 'approve' | 'deny',
): Promise<AuthBrowserResult> {
  const authorize = new URL(address);
  const response = await browser
    .get(`${authorize.pathname}${authorize.search}`)
    .redirects(0);
  const location = response.headers.location;
  if (response.status !== 302 || typeof location !== 'string') {
    return {
      kind: 'failed',
      reason: 'Authorization did not open the approval page',
    };
  }
  const transactionId = new URL(location, 'http://localhost').searchParams.get(
    'transaction',
  );
  if (!transactionId)
    return { kind: 'failed', reason: 'Authorization transaction was missing' };
  const approval = await browser
    .post(`/api/oauth/authorize/${choice}`)
    .send({ transactionId })
    .expect(200);
  return { kind: 'redirect', url: approvalRedirect(approval.body) };
}

function approvalRedirect(value: unknown): string {
  if (typeof value !== 'object' || value === null || !('data' in value)) {
    throw new Error('Approval response had no data');
  }
  const data = value.data;
  if (typeof data !== 'object' || data === null || !('redirectUri' in data)) {
    throw new Error('Approval response had no return address');
  }
  if (typeof data.redirectUri !== 'string')
    throw new Error('Return address was not a string');
  return data.redirectUri;
}
