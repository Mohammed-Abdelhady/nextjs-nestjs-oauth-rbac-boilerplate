import { describe, expect, it } from 'vitest';
import { createAuthEngine } from './engine';
import {
  CONFIG,
  Deferred,
  ScriptedTransport,
  oauthTokenReply,
  redirectFrom,
  successUserReply,
  testPorts,
} from './support';

describe('callback queue eviction', () => {
  it('evicts the oldest queued return when a full queue has only matching states', async () => {
    const sourceTransport = new ScriptedTransport();
    const sourcePorts = testPorts(sourceTransport);
    const source = createAuthEngine(CONFIG, sourcePorts);
    await source.restore();
    const opened = new Deferred<string>();
    const browserResult = new Deferred<{ kind: 'cancelled' }>();
    sourcePorts.authBrowser.beforeOpen = (address) => opened.resolve(address);
    sourcePorts.authBrowser.results.push(() => browserResult.promise);
    const sourceSignIn = source.signIn();
    const address = await opened.promise;
    const saved = sourcePorts.credentials.value;
    browserResult.resolve({ kind: 'cancelled' });
    await sourceSignIn;
    if (!saved) throw new Error('The authorization transaction was not persisted');

    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    ports.credentials.value = saved;
    ports.install = sourcePorts.install;
    transport.enqueue(
      oauthTokenReply('queue-fallback-access', 'queue-fallback-refresh'),
      successUserReply(),
    );
    const engine = createAuthEngine(CONFIG, ports);
    await expect(engine.restore()).resolves.toEqual({ kind: 'restored', status: 'signedOut' });
    const readStarted = new Deferred<void>();
    const releaseRead = new Deferred<void>();
    const originalRead = ports.credentials.read.bind(ports.credentials);
    ports.credentials.read = async () => {
      readStarted.resolve();
      await releaseRead.promise;
      return originalRead();
    };
    const restoring = engine.restore();
    await readStarted.promise;
    await ports.callbacks.deliver(redirectFrom(address, { error: 'access_denied' }));
    for (let index = 0; index < 15; index += 1)
      await ports.callbacks.deliver(redirectFrom(address, { code: `valid-${index}` }));
    await ports.callbacks.deliver(
      redirectFrom(address, {
        code: 'wrong-state',
        state: 'AAAAAAAAAAAAAAAAAAAAAA',
      }),
    );
    releaseRead.resolve();

    await expect(restoring).resolves.toEqual({ kind: 'restored', status: 'signedIn' });
    expect(transport.sent.find(({ path }) => path === '/api/oauth/token')?.body).toMatchObject({
      code: 'valid-0',
    });
    expect(engine.snapshot).toMatchObject({ status: 'signedIn', operation: 'none' });
    engine.dispose();
    source.dispose();
  });
});
