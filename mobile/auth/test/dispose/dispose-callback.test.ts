import { describe, expect, it } from 'vitest';
import { createAuthEngine } from '../support/engine';
import {
  CONFIG,
  Deferred,
  ScriptedTransport,
  acceptCode,
  oauthTokenReply,
  redirectFrom,
  successUserReply,
  testPorts,
} from '../support/support';
import { revokedTokens } from '../support/tracking';

describe('callbacks racing engine disposal', () => {
  it('ignores a late callback when a restored transaction remains on disk', async () => {
    const sourcePorts = testPorts(new ScriptedTransport());
    const source = createAuthEngine(CONFIG, sourcePorts);
    await source.restore();
    const opened = new Deferred<string>();
    const browserResult = new Deferred<{ kind: 'cancelled' }>();
    sourcePorts.authBrowser.beforeOpen = (address) => opened.resolve(address);
    sourcePorts.authBrowser.results.push(() => browserResult.promise);
    const sourceSignIn = source.signIn();
    const browserAddress = await opened.promise;
    const saved = sourcePorts.credentials.value;
    if (!saved) throw new Error('The authorization transaction was not persisted');
    browserResult.resolve({ kind: 'cancelled' });
    await sourceSignIn;

    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    ports.credentials.value = saved;
    ports.install = sourcePorts.install;
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const listener = [...ports.callbacks.listeners][0];
    if (!listener) throw new Error('The callback listener was not registered');
    const transaction = JSON.parse(saved) as { transaction: { state: string } };
    engine.dispose();

    await listener(
      redirectFrom(browserAddress, {
        code: 'after-dispose',
        state: transaction.transaction.state,
      }),
    );

    expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(0);
    expect(ports.credentials.value).toBe(saved);
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
    source.dispose();
  });

  it('keeps the saved session when disposal interrupts the profile read after exchange', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const profileStarted = new Deferred<void>();
    const profileReply = new Deferred<{ status: number; body: unknown }>();
    transport.respond = async ({ path }) => {
      if (path === '/api/oauth/token') return oauthTokenReply('profile-access', 'profile-refresh');
      if (path === '/api/user/profile') {
        profileStarted.resolve();
        return profileReply.promise;
      }
      return { status: 200, body: {} };
    };
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    acceptCode(ports.authBrowser);

    const signIn = engine.signIn();
    await profileStarted.promise;
    engine.dispose();
    await expect(signIn).resolves.toEqual({ kind: 'disposed' });
    profileReply.resolve(successUserReply());
    await Promise.resolve();

    expect(revokedTokens(transport)).toEqual([]);
    expect(ports.credentials.value).toContain('profile-refresh');
  });

  it('does not exchange a callback already captured when disposal clears the pending record', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const browserOpened = new Deferred<string>();
    const finishDelete = new Deferred<void>();
    const deleteStarted = new Deferred<void>();
    const browserResult = new Deferred<{ kind: 'cancelled' }>();
    ports.authBrowser.beforeOpen = (address) => browserOpened.resolve(address);
    ports.authBrowser.results.push(() => browserResult.promise);
    ports.credentials.beforeDelete = () => {
      deleteStarted.resolve();
      return finishDelete.promise;
    };
    transport.respond = async ({ path }) => {
      if (path === '/api/oauth/token') return oauthTokenReply('late-access', 'late-refresh');
      if (path === '/api/user/profile') return successUserReply();
      return { status: 200, body: {} };
    };
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const signIn = engine.signIn();
    const address = await browserOpened.promise;
    const callbackListener = [...ports.callbacks.listeners][0];
    if (!callbackListener) throw new Error('The callback listener was not registered');

    engine.dispose();
    await expect(signIn).resolves.toEqual({ kind: 'disposed' });
    await deleteStarted.promise;
    const callback = callbackListener(redirectFrom(address, { code: 'after-dispose' }));
    finishDelete.resolve();
    await callback;
    browserResult.resolve({ kind: 'cancelled' });

    expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(0);
    expect(ports.credentials.value).toBeUndefined();
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
  });
});
