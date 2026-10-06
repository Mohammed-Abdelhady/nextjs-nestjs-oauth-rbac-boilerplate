import { describe, expect, it } from 'vitest';
import { createApiClient, OAuthError } from '@app/sdk';
import { AuthPortError, AuthSessionError } from '../src';
import { createAuthEngine } from './engine';
import { CONFIG, ScriptedTransport, establishSession, testPorts } from './support';

describe('engine errors through the SDK client', () => {
  it('preserves the signed-out session error and sends no protected request', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    transport.enqueue({ status: 200, body: {} });
    await engine.signOut();
    const sentBefore = transport.sent.length;

    const failure = await createApiClient(engine.transport)
      .profile.get()
      .then(
        () => undefined,
        (error: unknown) => error,
      );

    expect(transport.sent).toHaveLength(sentBefore);
    expect(failure).toBeInstanceOf(AuthSessionError);
    expect(engine.snapshot.status).toBe('signedOut');
    expect(engine.snapshot.reason).toBeUndefined();
  });

  it('preserves the server kill switch OAuth error during refresh', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.advance(270_000);
    transport.enqueue({
      status: 400,
      body: { error: 'unauthorized_client', error_description: 'NATIVE_AUTH_DISABLED' },
    });

    const failure = createApiClient(engine.transport).profile.get();

    await expect(failure).rejects.toBeInstanceOf(OAuthError);
    await expect(failure).rejects.toMatchObject({
      error: 'unauthorized_client',
      errorDescription: 'NATIVE_AUTH_DISABLED',
    });
    expect(engine.snapshot.status).toBe('signedOut');
    expect(engine.snapshot.reason).toBe('disabled');
  });

  it('preserves a replayed refresh OAuth error through the SDK client', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.advance(270_000);
    transport.enqueue({ status: 400, body: { error: 'invalid_grant' } });

    const failure = createApiClient(engine.transport).profile.get();

    await expect(failure).rejects.toBeInstanceOf(OAuthError);
    await expect(failure).rejects.toMatchObject({ error: 'invalid_grant', status: 400 });
    expect(engine.snapshot.status).toBe('signedOut');
    expect(engine.snapshot.reason).toBe('oauthFailure');
  });

  it('preserves a typed engine port failure through the SDK client', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.monotonicTime = () => {
      throw new Error('clock unavailable');
    };

    const failure = createApiClient(engine.transport).profile.get();

    await expect(failure).rejects.toBeInstanceOf(AuthPortError);
    await expect(failure).rejects.toMatchObject({
      operation: 'clock.monotonicTime',
      reason: 'failed',
    });
  });

  it('preserves a storage failure raised while preparing refresh', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await establishSession(engine, ports, transport);
    ports.clock.advance(270_000);
    ports.credentials.beforeReplace = (value) =>
      value.includes('"refreshInFlight":true')
        ? Promise.reject(new Error('storage unavailable'))
        : Promise.resolve();
    transport.enqueue({
      status: 401,
      body: { success: false, error: { code: 'SESSION_INVALID', message: 'invalid' } },
    });

    const failure = createApiClient(engine.transport).profile.get();

    await expect(failure).rejects.toBeInstanceOf(AuthPortError);
    await expect(failure).rejects.toMatchObject({
      operation: 'credentials.replace',
      reason: 'failed',
    });
    expect(engine.snapshot).toMatchObject({ status: 'signedIn', operation: 'none' });
  });
});
