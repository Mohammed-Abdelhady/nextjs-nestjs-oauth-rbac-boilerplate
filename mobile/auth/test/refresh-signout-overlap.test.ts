import { describe, expect, it } from 'vitest';
import { HTTP_METHOD, OAuthError, TransportError, TRANSPORT_FAILURE } from '@app/sdk';
import { createAuthEngine } from './engine';
import {
  CONFIG,
  Deferred,
  REFRESH_TOKEN,
  ScriptedTransport,
  acceptCode,
  establishSession,
  failedApiReply,
  oauthTokenReply,
  successUserReply,
  testPorts,
} from './support';

describe('refresh failure during sign out', () => {
  it('does not hand a previous session refresh promise to a new session', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    const oldRefresh = new Deferred<{ status: number; body: unknown }>();
    const oldRefreshStarted = new Deferred<void>();
    let refreshCalls = 0;
    let profileCalls = 0;
    transport.respond = (request) => {
      if (request.path === '/api/oauth/token') {
        const body = request.body;
        if (typeof body === 'object' && body !== null && 'grant_type' in body) {
          if (body.grant_type === 'refresh_token') {
            refreshCalls += 1;
            if (refreshCalls > 1)
              return Promise.resolve(oauthTokenReply('rotated-access', 'rotated-refresh'));
            oldRefreshStarted.resolve();
            return oldRefresh.promise;
          }
          if (body.grant_type === 'authorization_code')
            return Promise.resolve(oauthTokenReply('new-access', 'new-refresh'));
        }
      }
      if (request.path === '/api/user/profile') {
        profileCalls += 1;
        return Promise.resolve(
          profileCalls === 1 || profileCalls === 3
            ? failedApiReply(401, 'SESSION_INVALID')
            : successUserReply(),
        );
      }
      if (request.path === '/api/oauth/revoke') return Promise.resolve({ status: 200, body: {} });
      return Promise.reject(new Error(`Unexpected request: ${request.path}`));
    };
    const oldRequest = engine.transport
      .request({ method: HTTP_METHOD.GET, path: '/api/user/profile' })
      .catch((error: unknown) => error);
    await oldRefreshStarted.promise;
    await engine.signOut();
    acceptCode(ports.authBrowser, 'new-session-code');
    await expect(engine.signIn()).resolves.toMatchObject({ kind: 'signedIn' });

    const nextRequest = engine.transport.request({
      method: HTTP_METHOD.GET,
      path: '/api/user/profile',
    });
    oldRefresh.reject(new TransportError(TRANSPORT_FAILURE.NO_RESPONSE));
    await expect(oldRequest).resolves.toBeInstanceOf(TransportError);
    await expect(nextRequest).resolves.toMatchObject({ status: 200 });

    const refreshTokens = transport.sent.flatMap(({ path, body }) =>
      path === '/api/oauth/token' && isRefreshRequest(body) ? [body.refresh_token] : [],
    );
    expect(refreshTokens).toEqual([REFRESH_TOKEN, 'new-refresh']);
    expect(engine.snapshot.status).toBe('signedIn');
  });

  it('does not publish stale failure state while sign-out deletion is pending', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.authBrowser.opened.length = 0;
    const firstDeleteStarted = new Deferred<void>();
    const secondDeleteStarted = new Deferred<void>();
    const finishFirstDelete = new Deferred<void>();
    const finishSecondDelete = new Deferred<void>();
    const refreshFailed = new Deferred<unknown>();
    let deleteCount = 0;
    ports.credentials.beforeDelete = () => {
      deleteCount += 1;
      if (deleteCount === 1) {
        firstDeleteStarted.resolve();
        return finishFirstDelete.promise;
      }
      secondDeleteStarted.resolve();
      return finishSecondDelete.promise;
    };
    transport.enqueue(
      failedApiReply(401, 'SESSION_INVALID'),
      { status: 400, body: { error: 'invalid_grant' } },
      { status: 200, body: {} },
    );
    const request = engine.transport
      .request({ method: HTTP_METHOD.GET, path: '/api/user/profile' })
      .then(
        () => refreshFailed.reject(new Error('Expected invalid_grant')),
        (error: unknown) => refreshFailed.resolve(error),
      );
    await firstDeleteStarted.promise;
    const signOut = engine.signOut();
    finishFirstDelete.resolve();
    await secondDeleteStarted.promise;
    const error = await refreshFailed.promise;
    const operationDuringSignOut = engine.snapshot.operation;
    const signInAttempt = engine.signIn();
    finishSecondDelete.resolve();
    const signInOutcome = await signInAttempt;
    await Promise.all([request, signOut]);

    expect(error).toBeInstanceOf(OAuthError);
    expect(operationDuringSignOut).toBe('signingOut');
    expect(signInOutcome.kind).toBe('signedOut');
    expect(ports.authBrowser.opened).toHaveLength(0);
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
  });
});

function isRefreshRequest(value: unknown): value is { refresh_token: string; grant_type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'grant_type' in value &&
    value.grant_type === 'refresh_token' &&
    'refresh_token' in value &&
    typeof value.refresh_token === 'string'
  );
}
