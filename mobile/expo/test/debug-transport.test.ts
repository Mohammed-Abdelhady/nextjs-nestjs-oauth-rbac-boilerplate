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

  it('passes every request through with its answer', async () => {
    const server = inner();
    const debug = createDebugTransport(server);

    expect(await debug.transport.request({ method: 'GET', path: '/api/user/profile' })).toEqual({
      status: 200,
      body: { ok: true },
    });
    await debug.transport.request({ method: 'POST', path: '/api/oauth/token', body: {} });
    await debug.transport.request({ method: 'POST', path: '/api/oauth/revoke', body: {} });

    expect(server.paths).toEqual(['/api/user/profile', '/api/oauth/token', '/api/oauth/revoke']);
  });

  it('counts refresh requests and not code exchanges', async () => {
    const debug = createDebugTransport(inner());
    const token = (body: unknown) =>
      debug.transport.request({ method: 'POST', path: '/api/oauth/token', body });

    await token({ grant_type: 'authorization_code', code: 'c' });
    expect(debug.refreshTokenRequests()).toBe(0);
    await token({ grant_type: 'refresh_token', refresh_token: 'r' });
    await token({ grant_type: 'refresh_token', refresh_token: 'r2' });
    await token(undefined);

    expect(debug.refreshTokenRequests()).toBe(2);
  });

  it('does not count a refresh-shaped body sent to another path', async () => {
    const debug = createDebugTransport(inner());

    await debug.transport.request({
      method: 'POST',
      path: '/api/oauth/revoke',
      body: { grant_type: 'refresh_token' },
    });

    expect(debug.refreshTokenRequests()).toBe(0);
  });
});
