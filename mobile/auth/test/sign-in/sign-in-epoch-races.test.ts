import { describe, expect, it } from 'vitest';
import { HTTP_METHOD } from '@app/sdk';
import { AuthSessionError } from '../../src';
import type { InstallIdentityResult } from '../../src';
import { createAuthEngine } from '../support/engine';
import {
  CONFIG,
  Deferred,
  ScriptedTransport,
  acceptCode,
  apiReply,
  failedApiReply,
  oauthTokenReply,
  successUserReply,
  testPorts,
} from '../support/support';

describe('sign-in work after sign out', () => {
  it('clears authorizing when sign-in follows sign-out during identity restore', async () => {
    const ports = testPorts(new ScriptedTransport());
    const identity = new Deferred<InstallIdentityResult>();
    const identityStarted = new Deferred<void>();
    ports.install.identity = () => {
      identityStarted.resolve();
      return identity.promise;
    };
    const engine = createAuthEngine(CONFIG, ports);
    const restore = engine.restore();
    await identityStarted.promise;
    await engine.signOut();
    identity.resolve({ kind: 'found', id: 'install-1' });
    await restore;

    await engine.signIn();

    expect(engine.snapshot.operation).toBe('none');
  });

  it('does not publish a late randomness failure over immediate sign out', async () => {
    const ports = testPorts(new ScriptedTransport());
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const randomBytes = new Deferred<Uint8Array>();
    const randomStarted = new Deferred<void>();
    const deleteStarted = new Deferred<void>();
    const finishDelete = new Deferred<void>();
    const signInSettled = new Deferred<void>();
    ports.crypto.randomBytes = async () => {
      randomStarted.resolve();
      return randomBytes.promise;
    };
    ports.credentials.beforeDelete = () => {
      deleteStarted.resolve();
      return finishDelete.promise;
    };

    const signIn = engine.signIn().finally(() => signInSettled.resolve());
    await randomStarted.promise;
    const signOut = engine.signOut();
    await deleteStarted.promise;
    randomBytes.reject(new Error('randomness failed'));
    await signInSettled.promise;

    expect(engine.snapshot.status).toBe('signedOut');
    expect(engine.snapshot.operation).toBe('signingOut');
    finishDelete.resolve();
    const [outcome] = await Promise.all([signIn, signOut]);
    expect(outcome).toEqual({ kind: 'signedOut' });
    expect(engine.snapshot.operation).toBe('none');
    expect(ports.authBrowser.opened).toHaveLength(0);
  });

  it('does not publish a late transaction-save failure over immediate sign out', async () => {
    const ports = testPorts(new ScriptedTransport());
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const saveStarted = new Deferred<void>();
    const rejectSave = new Deferred<void>();
    const deleteStarted = new Deferred<void>();
    const finishDelete = new Deferred<void>();
    const signInSettled = new Deferred<void>();
    ports.credentials.beforeReplace = (value) => {
      if (value.includes('"transaction"')) {
        saveStarted.resolve();
        return rejectSave.promise;
      }
      return Promise.resolve();
    };
    ports.credentials.beforeDelete = () => {
      deleteStarted.resolve();
      return finishDelete.promise;
    };

    const signIn = engine.signIn().finally(() => signInSettled.resolve());
    await saveStarted.promise;
    const signOut = engine.signOut();
    rejectSave.reject(new Error('storage failed'));
    await deleteStarted.promise;
    await signInSettled.promise;

    expect(engine.snapshot.status).toBe('signedOut');
    expect(engine.snapshot.operation).toBe('signingOut');
    expect(ports.authBrowser.opened).toHaveLength(0);
    finishDelete.resolve();
    const [outcome] = await Promise.all([signIn, signOut]);
    expect(outcome).toEqual({ kind: 'signedOut' });
    expect(engine.snapshot.operation).toBe('none');
  });

  it('does not open the browser when a transaction save succeeds after sign out', async () => {
    const ports = testPorts(new ScriptedTransport());
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const saveStarted = new Deferred<void>();
    const finishSave = new Deferred<void>();
    const deleteStarted = new Deferred<void>();
    const finishDelete = new Deferred<void>();
    ports.credentials.beforeReplace = (value) => {
      if (value.includes('"transaction"')) {
        saveStarted.resolve();
        return finishSave.promise;
      }
      return Promise.resolve();
    };
    ports.credentials.beforeDelete = () => {
      deleteStarted.resolve();
      return finishDelete.promise;
    };

    const signIn = engine.signIn();
    await saveStarted.promise;
    const signOut = engine.signOut();
    finishSave.resolve();
    await deleteStarted.promise;
    const signInSettled = new Deferred<void>();
    void signIn.then(() => signInSettled.resolve());
    await signInSettled.promise;
    const signInOutcome = await signIn;
    finishDelete.resolve();
    await signOut;

    expect(signInOutcome.kind).toBe('signedOut');
    expect(ports.authBrowser.opened).toHaveLength(0);
    expect(ports.credentials.value).toBeUndefined();
    expect(engine.snapshot.operation).toBe('none');
  });

  it('starts a new sign-in after sign out invalidates an exchange', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const firstExchange = new Deferred<{ status: number; body: unknown }>();
    const firstExchangeStarted = new Deferred<void>();
    let exchanges = 0;
    transport.respond = (request) => {
      if (request.path === '/api/oauth/token') {
        exchanges += 1;
        if (exchanges === 1) {
          firstExchangeStarted.resolve();
          return firstExchange.promise;
        }
        return Promise.resolve(oauthTokenReply('new-access', 'new-refresh'));
      }
      if (request.path === '/api/user/profile') return Promise.resolve(successUserReply());
      if (request.path === '/api/oauth/revoke') return Promise.resolve(apiReply({}));
      return Promise.reject(new Error(`Unexpected request: ${request.path}`));
    };
    acceptCode(ports.authBrowser, 'first-code');

    const first = engine.signIn();
    await firstExchangeStarted.promise;
    await engine.signOut();
    acceptCode(ports.authBrowser, 'second-code');
    const second = engine.signIn();
    firstExchange.resolve(oauthTokenReply('late-access', 'late-refresh'));
    const [firstOutcome, secondOutcome] = await Promise.all([first, second]);

    expect(second).not.toBe(first);
    expect(firstOutcome.kind).toBe('signedOut');
    expect(secondOutcome.kind).toBe('signedIn');
    expect(ports.authBrowser.opened).toHaveLength(2);
  });

  it('rejects a delayed response after profile failure ends the exchanged session', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const profileStarted = new Deferred<void>();
    const profileAnswer = new Deferred<{ status: number; body: unknown }>();
    const writeStarted = new Deferred<void>();
    const writeAnswer = new Deferred<{ status: number; body: unknown }>();
    transport.onRequest = ({ method, path }) => {
      if (path === '/api/user/profile' && method === 'GET') profileStarted.resolve();
      if (path === '/api/user/profile' && method === 'PATCH') writeStarted.resolve();
    };
    transport.respond = (request) => {
      if (request.path === '/api/oauth/token') return Promise.resolve(oauthTokenReply());
      if (request.path === '/api/user/profile' && request.method === 'GET')
        return profileAnswer.promise;
      if (request.path === '/api/user/profile' && request.method === 'PATCH')
        return writeAnswer.promise;
      if (request.path === '/api/oauth/revoke') return Promise.resolve(apiReply({ ok: true }));
      return Promise.reject(new Error(`Unexpected request: ${request.path}`));
    };
    acceptCode(ports.authBrowser);

    const signIn = engine.signIn();
    await profileStarted.promise;
    const delayedWrite = engine.transport.request({
      method: HTTP_METHOD.PATCH,
      path: '/api/user/profile',
      body: { name: 'A change from the ended session' },
    });
    await writeStarted.promise;
    profileAnswer.resolve(failedApiReply(500, 'PROFILE_FAILURE'));
    const signInOutcome = await signIn;
    writeAnswer.resolve(apiReply({ id: 'old session response' }));

    await expect(delayedWrite).rejects.toBeInstanceOf(AuthSessionError);
    expect(signInOutcome.kind).toBe('apiFailure');
    expect(transport.sent.filter(({ method }) => method === HTTP_METHOD.PATCH)).toHaveLength(1);
    expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
  });
});
