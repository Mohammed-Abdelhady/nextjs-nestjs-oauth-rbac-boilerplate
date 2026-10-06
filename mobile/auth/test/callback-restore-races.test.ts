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

const CREATED_AT = 1_800_000_000_000;
const MAXIMUM_TRANSACTION_AGE = 360_000;

async function saveTransaction() {
  const transport = new ScriptedTransport();
  const ports = testPorts(transport);
  const opened = new Deferred<string>();
  const browserResult = new Deferred<{ kind: 'cancelled' }>();
  ports.authBrowser.beforeOpen = (address) => opened.resolve(address);
  ports.authBrowser.results.push(() => browserResult.promise);
  const engine = createAuthEngine(CONFIG, ports);
  await engine.restore();
  const signIn = engine.signIn();
  const address = await opened.promise;
  const record = ports.credentials.value;
  browserResult.resolve({ kind: 'cancelled' });
  await signIn;
  if (!record) throw new Error('The authorization transaction was not persisted');
  return { address, record };
}

describe('saved authorization callbacks', () => {
  it('does not exchange a callback after a second restore supersedes its consume write', async () => {
    const saved = await saveTransaction();
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    ports.credentials.value = saved.record;
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const consumeStarted = new Deferred<void>();
    const finishConsume = new Deferred<void>();
    let holdConsume = true;
    ports.credentials.beforeReplace = (value) => {
      if (holdConsume && !value.includes('"transaction"') && !value.includes('"tokens"')) {
        holdConsume = false;
        consumeStarted.resolve();
        return finishConsume.promise;
      }
      return Promise.resolve();
    };
    transport.enqueue(oauthTokenReply('stale-access', 'stale-refresh'), successUserReply());

    const callback = ports.callbacks.deliver(
      redirectFrom(saved.address, { code: 'callback-before-restore' }),
    );
    await consumeStarted.promise;
    const secondRestore = engine.restore();
    finishConsume.resolve();
    await callback;
    await secondRestore;

    expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(0);
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
    expect(ports.credentials.value).toBeUndefined();
  });

  it('ignores a saved callback that arrives while a new attempt is deleting it', async () => {
    const saved = await saveTransaction();
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    ports.credentials.value = saved.record;
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const deleteStarted = new Deferred<void>();
    const finishDelete = new Deferred<void>();
    const browserOpened = new Deferred<void>();
    let firstDelete = true;
    ports.credentials.beforeDelete = () => {
      if (!firstDelete) return Promise.resolve();
      firstDelete = false;
      deleteStarted.resolve();
      return finishDelete.promise;
    };
    ports.authBrowser.beforeOpen = () => browserOpened.resolve();
    ports.authBrowser.results.push(() => ({ kind: 'cancelled' }));
    const signIn = engine.signIn();
    await deleteStarted.promise;

    await ports.callbacks.deliver(redirectFrom(saved.address, { code: 'stale-code' }));
    finishDelete.resolve();
    await browserOpened.promise;
    await expect(signIn).resolves.toEqual({ kind: 'cancelled' });

    expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(0);
    expect(ports.credentials.value).toBeUndefined();
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
  });

  it('ignores a previous saved link as soon as a new sign-in begins', async () => {
    const saved = await saveTransaction();
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    ports.credentials.value = saved.record;
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const randomStarted = new Deferred<void>();
    const randomGate = new Deferred<Uint8Array>();
    const originalRandomBytes = ports.crypto.randomBytes.bind(ports.crypto);
    let firstRandom = true;
    ports.crypto.randomBytes = (length) => {
      if (firstRandom) {
        firstRandom = false;
        randomStarted.resolve();
        return randomGate.promise;
      }
      return originalRandomBytes(length);
    };
    const newSignIn = engine.signIn();
    await randomStarted.promise;
    transport.enqueue(oauthTokenReply('stale-access', 'stale-refresh'), successUserReply());
    await ports.callbacks.deliver(redirectFrom(saved.address, { code: 'stale-code' }));
    const oldLinkWasIgnored =
      transport.sent.filter(({ path }) => path === '/api/oauth/token').length === 0;

    randomGate.reject(new Error('entropy unavailable'));
    await expect(newSignIn).resolves.toMatchObject({ kind: 'cryptoFailure' });
    expect(oldLinkWasIgnored).toBe(true);
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
    expect(ports.credentials.value).toBeUndefined();
  });

  it('does not consume a queued saved link after a synchronous new sign-in ends its transaction', async () => {
    const saved = await saveTransaction();
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    ports.credentials.value = saved.record;
    ports.callbacks.initial = redirectFrom(saved.address, { code: 'obsolete-code' });
    const deleteStarted = new Deferred<void>();
    const finishDelete = new Deferred<void>();
    ports.credentials.beforeDelete = () => {
      deleteStarted.resolve();
      return finishDelete.promise;
    };
    transport.respond = async ({ path, body }) => {
      if (path === '/api/oauth/revoke') return { status: 200, body: {} };
      if (
        path === '/api/oauth/token' &&
        typeof body === 'object' &&
        body !== null &&
        'code' in body &&
        body.code === 'obsolete-code'
      )
        return oauthTokenReply();
      if (path === '/api/oauth/token') return { status: 400, body: { error: 'invalid_grant' } };
      return successUserReply();
    };
    ports.authBrowser.results.push(() => ({ kind: 'cancelled' }));
    const engine = createAuthEngine(CONFIG, ports);
    let newAttempt: Promise<{ kind: string }> | undefined;
    engine.subscribe((snapshot) => {
      if (snapshot.status === 'signedOut' && !newAttempt) newAttempt = engine.signIn();
    });
    const restore = engine.restore();
    await deleteStarted.promise;
    finishDelete.resolve();
    await restore;
    if (!newAttempt) throw new Error('The replacement sign-in did not start');
    await expect(newAttempt).resolves.toMatchObject({ kind: 'cancelled' });

    const obsoleteExchanges = transport.sent.filter(
      ({ path, body }) =>
        path === '/api/oauth/token' &&
        typeof body === 'object' &&
        body !== null &&
        'code' in body &&
        body.code === 'obsolete-code',
    );
    expect(obsoleteExchanges).toHaveLength(0);
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
  });

  it('does not process a cold-start link queued before restore starts a new attempt', async () => {
    const saved = await saveTransaction();
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    ports.credentials.value = saved.record;
    const deleteStarted = new Deferred<void>();
    const finishDelete = new Deferred<void>();
    const browserOpened = new Deferred<void>();
    let firstDelete = true;
    ports.credentials.beforeDelete = () => {
      if (!firstDelete) return Promise.resolve();
      firstDelete = false;
      deleteStarted.resolve();
      return finishDelete.promise;
    };
    ports.authBrowser.beforeOpen = () => browserOpened.resolve();
    ports.authBrowser.results.push(() => ({ kind: 'cancelled' }));
    transport.enqueue(oauthTokenReply('obsolete-access', 'obsolete-refresh'), successUserReply());
    const engine = createAuthEngine(CONFIG, ports);
    let replacementSignIn: Promise<{ kind: string }> | undefined;
    engine.subscribe((snapshot) => {
      if (snapshot.status === 'signedOut' && !replacementSignIn)
        replacementSignIn = engine.signIn();
    });

    const restore = engine.restore();
    await ports.callbacks.deliver(redirectFrom(saved.address, { code: 'queued-obsolete-code' }));
    await deleteStarted.promise;
    await expect(restore).resolves.toMatchObject({ kind: 'restored', status: 'signedOut' });

    finishDelete.resolve();
    await browserOpened.promise;
    if (!replacementSignIn) throw new Error('The replacement sign-in did not start');
    await expect(replacementSignIn).resolves.toMatchObject({ kind: 'cancelled' });

    expect(
      transport.sent.filter(
        ({ path, body }) =>
          path === '/api/oauth/token' &&
          typeof body === 'object' &&
          body !== null &&
          'code' in body &&
          body.code === 'queued-obsolete-code',
      ),
    ).toHaveLength(0);
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
  });

  it('accepts a new callback when a restarted engine reuses the saved operation id', async () => {
    const saved = await saveTransaction();
    const oldRecord = JSON.parse(saved.record) as {
      transaction: { operationId: string };
    };
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    ports.credentials.value = saved.record;
    const browserOpened = new Deferred<string>();
    const browserResult = new Deferred<{ kind: 'cancelled' }>();
    const exchangeStarted = new Deferred<void>();
    ports.authBrowser.beforeOpen = (address) => browserOpened.resolve(address);
    ports.authBrowser.results.push(() => browserResult.promise);
    transport.respond = async ({ path, body }) => {
      if (path === '/api/oauth/token') {
        if (
          typeof body === 'object' &&
          body !== null &&
          'grant_type' in body &&
          body.grant_type === 'authorization_code' &&
          'code' in body &&
          body.code === 'new-code'
        ) {
          exchangeStarted.resolve();
          return oauthTokenReply('new-access', 'new-refresh');
        }
      }
      if (path === '/api/user/profile') return successUserReply();
      return { status: 400, body: { error: 'invalid_grant' } };
    };
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const signIn = engine.signIn();
    const address = await browserOpened.promise;
    const newRecord = JSON.parse(ports.credentials.value ?? '{}') as {
      transaction?: { operationId: string };
    };
    expect(oldRecord.transaction.operationId).toBe('2-1-AwMDAwMDAwMDAwMDAwMDAw');
    expect(newRecord.transaction?.operationId).toBe('2-1-AwMDAwMDAwMDAwMDAwMDAw');

    await ports.callbacks.deliver(redirectFrom(address, { code: 'new-code' }));
    await exchangeStarted.promise;
    await expect(signIn).resolves.toMatchObject({ kind: 'signedIn' });
    browserResult.resolve({ kind: 'cancelled' });

    expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(1);
    expect(ports.credentials.value).toContain('new-refresh');
    expect(engine.snapshot).toMatchObject({ status: 'signedIn', operation: 'none' });
  });

  it('drains links queued during restore when no transaction exists', async () => {
    const saved = await saveTransaction();
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const identity = new Deferred<{ kind: 'found'; id: string }>();
    const identityStarted = new Deferred<void>();
    ports.install.identity = () => {
      identityStarted.resolve();
      return identity.promise;
    };
    const engine = createAuthEngine(CONFIG, ports);
    const firstRestore = engine.restore();
    await identityStarted.promise;
    await ports.callbacks.deliver(redirectFrom(saved.address, { code: 'stale-code' }));
    identity.resolve({ kind: 'found', id: 'install-1' });
    await firstRestore;
    ports.credentials.value = saved.record;
    transport.enqueue(oauthTokenReply('stale-access', 'stale-refresh'), successUserReply());

    await engine.restore();

    expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(0);
    expect(engine.snapshot.status).toBe('signedOut');
    expect(ports.credentials.value).toContain('"transaction"');
  });

  it.each([
    ['wall clock before creation', CREATED_AT - 1, CREATED_AT + MAXIMUM_TRANSACTION_AGE],
    ['expiry beyond the maximum window', CREATED_AT + 1, CREATED_AT + MAXIMUM_TRANSACTION_AGE + 1],
  ])('deletes a transaction with invalid lifetime: %s', async (_name, wallTime, expiresAt) => {
    const saved = await saveTransaction();
    const record = JSON.parse(saved.record) as {
      transaction: { createdAt: number; expiresAt: number };
    };
    record.transaction.createdAt = CREATED_AT;
    record.transaction.expiresAt = expiresAt;
    const ports = testPorts(new ScriptedTransport());
    ports.credentials.value = JSON.stringify(record);
    ports.clock.wall = wallTime;
    const engine = createAuthEngine(CONFIG, ports);

    await engine.restore();

    expect(ports.credentials.value).toBeUndefined();
    expect(engine.snapshot.status).toBe('signedOut');
  });
});
