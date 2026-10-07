import {
  FAKE_SHA256,
  FakeCrypto,
  FakeLinking,
  FakeMarkerFile,
  FakeSecureStore,
  FakeServer,
  FakeTime,
  FakeUuid,
  FakeWebBrowser,
  SERVER_RETURN_ADDRESS,
  SERVER_USER,
} from '@app/native-adapters/testing';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/logic/resolve-config';
import { createShellAuth, type ShellAuth } from '../src/shell';

/** Written by hand: prefix, escaped client id, environment. */
const RECORD_KEY = 'auth.com_002eexample_002emobile.development';
const KEYCHAIN_OPTIONS = { keychainAccessible: 4 };

/** One device: what survives when the app is killed and started again. */
function device() {
  const store = new FakeSecureStore();
  const marker = new FakeMarkerFile();
  const server = new FakeServer();
  const uuid = new FakeUuid();
  const browser = new FakeWebBrowser();
  browser.respond = (url) => ({ type: 'success', url: server.authorize(url) });

  const start = (launchAddress: string | null = null): ShellAuth =>
    createShellAuth(
      {
        secureStore: store,
        keychainOptions: KEYCHAIN_OPTIONS,
        webBrowser: browser,
        crypto: new FakeCrypto(),
        sha256Algorithm: FAKE_SHA256,
        linking: new FakeLinking(launchAddress),
        installMarker: marker,
        uuid,
        clock: new FakeTime(),
        timers: new FakeTime(),
        http: server,
      },
      {
        configuration: resolveConfig({ apiOrigin: undefined, development: true }),
        ephemeralBrowserSession: true,
      },
    );
  return { store, marker, server, browser, start };
}

async function signedInDevice() {
  const parts = device();
  const app = parts.start();
  await app.engine.restore();
  const outcome = await app.engine.signIn();
  return { ...parts, app, outcome };
}

describe('the shell from sign-in to sign-out, over fakes of the native modules', () => {
  it('signs in from a cold app through the browser and stores one record', async () => {
    const { outcome, app, browser, store, server } = await signedInDevice();

    expect(outcome.kind).toBe('signedIn');
    expect(app.engine.snapshot.status).toBe('signedIn');
    expect(app.engine.snapshot.profile?.email).toBe('person@example.test');
    expect(browser.opened).toHaveLength(1);
    expect(browser.opened[0]?.redirectUrl).toBe(SERVER_RETURN_ADDRESS);
    expect(browser.opened[0]?.options).toEqual({ preferEphemeralSession: true });
    expect(store.items.has(RECORD_KEY)).toBe(true);
    expect(server.requests.every(({ credentials }) => credentials === 'omit')).toBe(true);
  });

  it('restores the session after a cold start without the browser', async () => {
    const { start, browser } = await signedInDevice();

    const relaunched = start();
    const outcome = await relaunched.engine.restore();

    expect(outcome).toEqual({ kind: 'restored', status: 'signedIn' });
    expect(browser.opened).toHaveLength(1);
  });

  it('refreshes once before the first request of a restored session', async () => {
    const { start, server } = await signedInDevice();
    const relaunched = start();
    await relaunched.engine.restore();

    const profile = await relaunched.client.profile.get();

    expect(profile).toEqual(SERVER_USER);
    expect(server.refreshes).toBe(1);
    expect(relaunched.debug.refreshRequests()).toBe(1);
  });

  it('answers an expired access token with one refresh and then the profile', async () => {
    const { app, server } = await signedInDevice();
    await app.client.profile.get();
    expect(server.refreshes).toBe(0);

    app.debug.expireNextRequest();
    const profile = await app.client.profile.get();

    expect(profile.email).toBe('person@example.test');
    expect(server.refreshes).toBe(1);
  });

  it('keeps the rotated token, so a second cold start can still refresh', async () => {
    const { start, server } = await signedInDevice();
    const second = start();
    await second.engine.restore();
    await second.client.profile.get();

    const third = start();
    await third.engine.restore();

    expect((await third.client.profile.get()).id).toBe('user-1');
    expect(server.refreshes).toBe(2);
  });

  it('signs out: the record is gone and the server revoked the current token', async () => {
    const { app, store, server } = await signedInDevice();

    const outcome = await app.engine.signOut();

    expect(outcome).toEqual({ kind: 'signedOut', revocation: 'revoked' });
    expect(app.engine.snapshot.status).toBe('signedOut');
    expect(store.items.has(RECORD_KEY)).toBe(false);
    expect(server.revoked).toEqual(['refresh-1']);
  });

  it('leaves no session and no error state when the person closes the browser', async () => {
    const { start, browser, store } = device();
    browser.respond = () => ({ type: 'cancel' });
    const app = start();
    await app.engine.restore();

    const outcome = await app.engine.signIn();

    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(app.engine.snapshot).toEqual({ status: 'signedOut', operation: 'none' });
    expect(store.items.has(RECORD_KEY)).toBe(false);
  });

  it('opens one browser for two taps on sign in', async () => {
    const { start, browser } = device();
    const app = start();
    await app.engine.restore();

    await Promise.all([app.engine.signIn(), app.engine.signIn()]);

    expect(browser.opened).toHaveLength(1);
  });

  it('reports a locked keychain as blocked storage and keeps the record', async () => {
    const { start, store } = await signedInDevice();
    store.readFailure = 'User interaction is not allowed.';
    const relaunched = start();

    const outcome = await relaunched.engine.restore();

    // The install id lives in the same keychain and is read first, and its port has no `locked`.
    expect(outcome).toEqual({ kind: 'storageBlocked', reason: 'installUnavailable' });
    expect(relaunched.engine.snapshot.status).toBe('storageBlocked');
    expect(store.items.has(RECORD_KEY)).toBe(true);
  });

  it('says the record itself is locked when only that item cannot be read', async () => {
    const { start, store } = await signedInDevice();
    store.readFailure = 'User interaction is not allowed.';
    store.readFailureKey = RECORD_KEY;
    const relaunched = start();

    const outcome = await relaunched.engine.restore();

    expect(outcome).toEqual({ kind: 'storageBlocked', reason: 'locked' });
    expect(relaunched.engine.snapshot.status).toBe('storageBlocked');
    expect(store.items.has(RECORD_KEY)).toBe(true);
  });

  it('restores once the keychain can be read again', async () => {
    const { start, store } = await signedInDevice();
    store.readFailure = 'User interaction is not allowed.';
    const relaunched = start();
    await relaunched.engine.restore();
    store.readFailure = undefined;

    expect(await relaunched.engine.restore()).toEqual({ kind: 'restored', status: 'signedIn' });
  });

  it('does not use a record the keychain kept from an earlier install', async () => {
    const { start, marker, store, browser } = await signedInDevice();
    marker.present = false;
    const reinstalled = start();

    const outcome = await reinstalled.engine.restore();

    expect(outcome).toEqual({ kind: 'restored', status: 'signedOut' });
    expect(store.items.has(RECORD_KEY)).toBe(false);
    expect(browser.opened).toHaveLength(1);
  });
});
