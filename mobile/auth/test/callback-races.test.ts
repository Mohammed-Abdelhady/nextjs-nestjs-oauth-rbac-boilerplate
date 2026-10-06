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

describe('callback operation races', () => {
  it('settles the captured sign-in waiter when wall time fails during callback handling', async () => {
    const ports = testPorts(new ScriptedTransport());
    const browser = new Deferred<{ kind: 'cancelled' }>();
    const opened = new Deferred<string>();
    ports.authBrowser.results.push(() => browser.promise);
    ports.authBrowser.beforeOpen = (address) => opened.resolve(address);
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const signIn = engine.signIn();
    const authorizeAddress = await opened.promise;
    ports.clock.wallTime = () => {
      throw new Error('wall clock unavailable');
    };

    await ports.callbacks.deliver(redirectFrom(authorizeAddress, { code: 'clock-failure' }));

    await expect(signIn).resolves.toMatchObject({ kind: 'clockFailure' });
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
    expect(ports.credentials.value).toBeUndefined();
    browser.resolve({ kind: 'cancelled' });
  });

  it('queues a link delivered during restore until the saved transaction is loaded', async () => {
    const firstPorts = testPorts(new ScriptedTransport());
    const browser = new Deferred<{ kind: 'cancelled' }>();
    const opened = new Deferred<string>();
    firstPorts.authBrowser.results.push(() => browser.promise);
    firstPorts.authBrowser.beforeOpen = (address) => opened.resolve(address);
    const first = createAuthEngine(CONFIG, firstPorts);
    await first.restore();
    const firstSignIn = first.signIn();
    const authorizeAddress = await opened.promise;
    const callback = redirectFrom(authorizeAddress, { code: 'restore-race' });
    const savedRecord = firstPorts.credentials.value;
    const transactionDeleted = new Deferred<void>();
    firstPorts.credentials.afterDelete = () => transactionDeleted.resolve();
    first.dispose();
    await expect(firstSignIn).resolves.toEqual({ kind: 'disposed' });
    await transactionDeleted.promise;

    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    ports.credentials = firstPorts.credentials;
    ports.credentials.value = savedRecord;
    ports.install = firstPorts.install;
    const identity = new Deferred<{ kind: 'found'; id: string }>();
    const identityStarted = new Deferred<void>();
    ports.install.identity = () => {
      identityStarted.resolve();
      return identity.promise;
    };
    transport.enqueue(oauthTokenReply(), successUserReply());
    const restarted = createAuthEngine(CONFIG, ports);
    const restore = restarted.restore();
    await identityStarted.promise;
    await ports.callbacks.deliver(callback);
    identity.resolve({ kind: 'found', id: 'install-1' });

    await expect(restore).resolves.toMatchObject({ kind: 'restored', status: 'signedIn' });
    expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(1);
    browser.resolve({ kind: 'cancelled' });
  });

  it('processes a saved transaction link queued during a later restore', async () => {
    const firstPorts = testPorts(new ScriptedTransport());
    const browser = new Deferred<{ kind: 'cancelled' }>();
    const opened = new Deferred<string>();
    firstPorts.authBrowser.results.push(() => browser.promise);
    firstPorts.authBrowser.beforeOpen = (address) => opened.resolve(address);
    const first = createAuthEngine(CONFIG, firstPorts);
    await first.restore();
    const firstSignIn = first.signIn();
    const authorizeAddress = await opened.promise;
    const callback = redirectFrom(authorizeAddress, { code: 'second-restore' });
    const savedRecord = firstPorts.credentials.value;
    const transactionDeleted = new Deferred<void>();
    firstPorts.credentials.afterDelete = () => transactionDeleted.resolve();
    first.dispose();
    await expect(firstSignIn).resolves.toEqual({ kind: 'disposed' });
    await transactionDeleted.promise;

    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    ports.credentials = firstPorts.credentials;
    ports.credentials.value = savedRecord;
    ports.install = firstPorts.install;
    transport.enqueue(oauthTokenReply(), successUserReply());
    const restarted = createAuthEngine(CONFIG, ports);
    await expect(restarted.restore()).resolves.toEqual({ kind: 'restored', status: 'signedOut' });

    const identity = new Deferred<{ kind: 'found'; id: string }>();
    const identityStarted = new Deferred<void>();
    ports.install.identity = () => {
      identityStarted.resolve();
      return identity.promise;
    };
    const restore = restarted.restore();
    await identityStarted.promise;
    await ports.callbacks.deliver(callback);
    identity.resolve({ kind: 'found', id: 'install-1' });

    await expect(restore).resolves.toEqual({ kind: 'restored', status: 'signedIn' });
    expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(1);
    expect(restarted.snapshot).toMatchObject({ status: 'signedIn', operation: 'none' });
    browser.resolve({ kind: 'cancelled' });
  });
});
