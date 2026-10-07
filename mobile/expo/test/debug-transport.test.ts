import type { AbortSignalPort } from '@app/native-auth';
import type { Transport, TransportResponse } from '@app/sdk';
import { describe, expect, it } from 'vitest';
import { createDebugTransport } from '../src/logic/debug-transport';

describe('debug transport', () => {
  function inner(): Transport<AbortSignalPort> & { paths: string[] } {
    const paths: string[] = [];
    const answer: TransportResponse = { status: 200, body: { ok: true } };
    return {
      paths,
      request: (request) => {
        paths.push(request.path);
        return Promise.resolve(answer);
      },
    };
  }

  it('passes requests through until it is told to expire one', async () => {
    const server = inner();
    const debug = createDebugTransport(server);

    expect(await debug.transport.request({ method: 'GET', path: '/api/user/profile' })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(server.paths).toEqual(['/api/user/profile']);
  });

  it('answers one API request with a local 401 and sends the next one', async () => {
    const server = inner();
    const debug = createDebugTransport(server);
    debug.expireNextRequest();

    const first = await debug.transport.request({ method: 'GET', path: '/api/user/profile' });
    const second = await debug.transport.request({ method: 'GET', path: '/api/user/profile' });

    expect(first).toEqual({ status: 401, body: undefined });
    expect(second.status).toBe(200);
    expect(server.paths).toEqual(['/api/user/profile']);
  });

  it('never answers a token or revoke request locally', async () => {
    const server = inner();
    const debug = createDebugTransport(server);
    debug.expireNextRequest();

    await debug.transport.request({ method: 'POST', path: '/api/oauth/token', body: {} });
    await debug.transport.request({ method: 'POST', path: '/api/oauth/revoke', body: {} });
    const api = await debug.transport.request({ method: 'GET', path: '/api/user/profile?x=1' });

    expect(server.paths).toEqual(['/api/oauth/token', '/api/oauth/revoke']);
    expect(api.status).toBe(401);
  });

  it('counts refresh requests and not code exchanges', async () => {
    const debug = createDebugTransport(inner());
    const token = (body: unknown) =>
      debug.transport.request({ method: 'POST', path: '/api/oauth/token', body });

    await token({ grant_type: 'authorization_code', code: 'c' });
    expect(debug.refreshRequests()).toBe(0);
    await token({ grant_type: 'refresh_token', refresh_token: 'r' });
    await token({ grant_type: 'refresh_token', refresh_token: 'r2' });
    await token(undefined);

    expect(debug.refreshRequests()).toBe(2);
  });
});
