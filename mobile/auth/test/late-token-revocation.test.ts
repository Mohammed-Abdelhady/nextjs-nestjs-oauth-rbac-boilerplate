import { describe, expect, it } from 'vitest';
import { HTTP_METHOD, TransportError } from '@app/sdk';
import { SIGN_OUT_REVOKE_TIMEOUT_MS } from '../src/constants';
import { createAuthEngine } from './engine';
import { revokedTokens } from './tracking';
import {
  CONFIG,
  Deferred,
  ScriptedTransport,
  acceptCode,
  establishSession,
  testPorts,
} from './support';

describe('late token revocation', () => {
  it('revokes tokens returned after the authorization exchange deadline', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const exchangeStarted = new Deferred<void>();
    const revokeStarted = new Deferred<void>();
    const exchangeAnswer = new Deferred<{ status: number; body: unknown }>();
    transport.onRequest = ({ path, body }) => {
      if (path === '/api/oauth/token' && isCodeExchange(body)) exchangeStarted.resolve();
      if (path === '/api/oauth/revoke') revokeStarted.resolve();
    };
    transport.enqueue(() => exchangeAnswer.promise, { status: 200, body: {} });
    acceptCode(ports.authBrowser);
    const signIn = engine.signIn();
    await exchangeStarted.promise;
    ports.timer.fireDelay(15_000);
    const outcome = await signIn;

    exchangeAnswer.resolve(tokenReply('late-access', 'late-refresh'));
    await revokeStarted.promise;

    expect(outcome.kind).toBe('transportFailure');
    expect(revokedTokens(transport)).toEqual(['late-refresh']);
  });

  it('revokes a rotated token returned after the refresh deadline', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.advance(270_000);
    const refreshStarted = new Deferred<void>();
    const revokeStarted = new Deferred<void>();
    const refreshAnswer = new Deferred<{ status: number; body: unknown }>();
    transport.onRequest = ({ path, body }) => {
      if (path === '/api/oauth/token' && isRefresh(body)) refreshStarted.resolve();
      if (path === '/api/oauth/revoke') revokeStarted.resolve();
    };
    transport.enqueue(() => refreshAnswer.promise, { status: 200, body: {} });
    const request = engine.transport.request({
      method: HTTP_METHOD.GET,
      path: '/api/user/profile',
    });
    await refreshStarted.promise;
    ports.timer.fireDelay(15_000);
    await expect(request).rejects.toBeInstanceOf(TransportError);

    refreshAnswer.resolve(tokenReply('late-access', 'late-refresh'));
    await revokeStarted.promise;

    expect(engine.snapshot.status).toBe('reauthRequired');
    expect(revokedTokens(transport)).toEqual(['late-refresh']);
  });

  it('revokes an exchange result that arrives after disposal', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const exchangeStarted = new Deferred<void>();
    const revokeTimerScheduled = new Deferred<void>();
    const revokeStarted = new Deferred<void>();
    const exchangeAnswer = new Deferred<{ status: number; body: unknown }>();
    const schedule = ports.timer.after.bind(ports.timer);
    ports.timer.after = (milliseconds, callback) => {
      if (milliseconds === SIGN_OUT_REVOKE_TIMEOUT_MS) revokeTimerScheduled.resolve();
      return schedule(milliseconds, callback);
    };
    transport.onRequest = ({ path, body }) => {
      if (path === '/api/oauth/token' && isCodeExchange(body)) exchangeStarted.resolve();
      if (path === '/api/oauth/revoke') revokeStarted.resolve();
    };
    transport.respond = (request) => {
      if (request.path === '/api/oauth/token') return exchangeAnswer.promise;
      if (request.path === '/api/oauth/revoke') return Promise.resolve({ status: 200, body: {} });
      return Promise.reject(new Error(`Unexpected request: ${request.path}`));
    };
    acceptCode(ports.authBrowser);
    const signIn = engine.signIn();
    await exchangeStarted.promise;

    engine.dispose();
    await expect(signIn).resolves.toEqual({ kind: 'disposed' });
    exchangeAnswer.resolve(tokenReply('late-access', 'late-refresh'));
    await revokeTimerScheduled.promise;
    await revokeStarted.promise;

    expect(revokedTokens(transport)).toEqual(['late-refresh']);
    expect(ports.credentials.value).toBeUndefined();
  });
});

function tokenReply(accessToken: string, refreshToken: string) {
  return {
    status: 200,
    body: {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 300,
      refresh_token: refreshToken,
      scope: 'api',
    },
  };
}

function isCodeExchange(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'grant_type' in value &&
    value.grant_type === 'authorization_code'
  );
}

function isRefresh(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'grant_type' in value &&
    value.grant_type === 'refresh_token'
  );
}
