import type { FetchInit, FetchResponseApi, HttpApi } from '../../src/types/modules';

export const SERVER_ORIGIN = 'http://localhost:5001';
export const SERVER_CLIENT_ID = 'com.example.mobile';
export const SERVER_RETURN_ADDRESS = 'com.example.mobile://oauth/callback';
export const AUTHORIZATION_CODE = 'code-1';

export const SERVER_USER = {
  id: 'user-1',
  email: 'person@example.test',
  name: 'Test Person',
  role: 'user',
  permissions: [],
  authProvider: 'password',
  isVerified: true,
  twoFactorEnabled: false,
  passkeyCount: 0,
  linkedProviders: [],
};

interface ServerSignal {
  aborted: boolean;
}

export interface ServerRequest {
  method: string;
  path: string;
  credentials: string;
  body: Record<string, unknown>;
}

function json(status: number, body: unknown): FetchResponseApi {
  return { status, text: async () => JSON.stringify(body) };
}

function parseBody(text: string | undefined): Record<string, unknown> {
  const value: unknown = text === undefined ? {} : JSON.parse(text);
  return typeof value === 'object' && value !== null ? { ...value } : {};
}

/**
 * The local server as `fetch` sees it: one native token family that rotates on
 * every refresh, a profile behind the current access token, and revocation.
 */
export class FakeServer implements HttpApi<ServerSignal> {
  readonly requests: ServerRequest[] = [];
  readonly revoked: unknown[] = [];
  private generation = 0;
  private active = false;

  get refreshes(): number {
    return this.requests.filter(({ body }) => body.grant_type === 'refresh_token').length;
  }

  /** What the sign-in page does: sends the browser back with a code and the state. */
  authorize(address: string): string {
    const state = /[?&]state=([^&]+)/.exec(address)?.[1] ?? '';
    return `${SERVER_RETURN_ADDRESS}?code=${AUTHORIZATION_CODE}&state=${state}`;
  }

  createAbort(): { signal: ServerSignal; abort(): void } {
    const signal = { aborted: false };
    return { signal, abort: () => void (signal.aborted = true) };
  }

  async fetch(address: string, init: FetchInit<ServerSignal>): Promise<FetchResponseApi> {
    if (!address.startsWith(SERVER_ORIGIN)) throw new TypeError('Network request failed');
    const path = address.slice(SERVER_ORIGIN.length);
    const body = parseBody(init.body);
    this.requests.push({ method: init.method, path, credentials: init.credentials, body });
    if (path === '/api/oauth/token') return this.token(body);
    if (path === '/api/oauth/revoke') {
      this.revoked.push(body.token);
      this.active = false;
      return json(200, {});
    }
    if (path === '/api/user/profile' && this.authorized(init.headers)) {
      return json(200, { success: true, data: SERVER_USER });
    }
    return json(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'No session' } });
  }

  private authorized(headers: Record<string, string>): boolean {
    return this.active && headers.Authorization === `Bearer access-${this.generation}`;
  }

  private token(body: Record<string, unknown>): FetchResponseApi {
    const validCode =
      body.grant_type === 'authorization_code' &&
      body.code === AUTHORIZATION_CODE &&
      body.client_id === SERVER_CLIENT_ID &&
      body.redirect_uri === SERVER_RETURN_ADDRESS &&
      typeof body.code_verifier === 'string';
    const validRefresh =
      body.grant_type === 'refresh_token' &&
      this.active &&
      body.refresh_token === `refresh-${this.generation}`;
    if (!validCode && !validRefresh) return json(400, { error: 'invalid_grant' });
    this.generation += 1;
    this.active = true;
    return json(200, {
      access_token: `access-${this.generation}`,
      refresh_token: `refresh-${this.generation}`,
      expires_in: 900,
      token_type: 'Bearer',
      scope: 'api',
    });
  }
}
