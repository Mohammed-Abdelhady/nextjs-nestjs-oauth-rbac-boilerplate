import { describe, expect, it } from 'vitest';
import { createAuthBrowserPort } from '../src/ports/auth-browser';
import { createCallbackPort } from '../src/ports/callbacks';
import { TestAbort } from './support/abort';
import { FakeLinking, FakeWebBrowser } from './support/fake-modules';
import { settle } from './support/subject';

const AUTHORIZE = 'https://api.example.test/api/oauth/authorize?state=s1';
const RETURN = 'sampleapp://auth/callback';
const LINK = 'sampleapp://auth/callback?code=A&state=s1';
const OTHER_LINK = 'sampleapp://auth/callback?code=B&state=s2';

describe('browser adapter over the web browser module', () => {
  function setup() {
    const browser = new FakeWebBrowser();
    const port = createAuthBrowserPort(browser, { redirectUri: RETURN, ephemeralSession: true });
    return { browser, port };
  }

  it('opens the session with the return address and the private-session choice', async () => {
    const { browser, port } = setup();
    browser.steps.push({ kind: 'resolve', result: { type: 'cancel' } });

    await port.open(AUTHORIZE, new TestAbort().signal);

    expect(browser.opened).toEqual([
      { url: AUTHORIZE, redirectUrl: RETURN, options: { preferEphemeralSession: true } },
    ]);
  });

  it('does not open a browser for a signal that is already aborted', async () => {
    const { browser, port } = setup();
    const controller = new TestAbort();
    controller.abort();

    expect(await port.open(AUTHORIZE, controller.signal)).toEqual({ kind: 'dismissed' });
    expect(browser.opened).toEqual([]);
  });

  it('ends the session for the engine when the platform cannot close the browser', async () => {
    const { browser, port } = setup();
    browser.dismissAuthSession = () => {
      throw new Error('WebBrowser.dismissBrowser is not available on android');
    };
    const controller = new TestAbort();
    const opened = port.open(AUTHORIZE, controller.signal);
    await settle();

    controller.abort();

    expect(await opened).toEqual({ kind: 'dismissed' });
  });

  it('stops listening for abort once the session has ended', async () => {
    const { browser, port } = setup();
    browser.steps.push({ kind: 'resolve', result: { type: 'success', url: LINK } });
    const controller = new TestAbort();

    expect(await port.open(AUTHORIZE, controller.signal)).toEqual({ kind: 'redirect', url: LINK });
    controller.abort();

    expect(browser.dismissals).toBe(0);
  });

  it('fails a second session while the first is open and leaves the first running', async () => {
    const { browser, port } = setup();
    const first = port.open(AUTHORIZE, new TestAbort().signal);
    await settle();

    expect(await port.open(AUTHORIZE, new TestAbort().signal)).toEqual({
      kind: 'failed',
      reason: 'ERR_WEB_BROWSER_ALREADY_OPEN',
    });
    expect(browser.isOpen).toBe(true);

    browser.dismissAuthSession();
    expect(await first).toEqual({ kind: 'dismissed' });
  });

  it('reports a module that throws instead of rejecting', async () => {
    const { browser, port } = setup();
    browser.openAuthSessionAsync = () => {
      throw new Error('The method is not available.');
    };

    expect(await port.open(AUTHORIZE, new TestAbort().signal)).toEqual({
      kind: 'failed',
      reason: 'The method is not available.',
    });
  });
});

describe('callback adapter over the linking module', () => {
  function listen(port: ReturnType<typeof createCallbackPort>) {
    const received: string[] = [];
    const unsubscribe = port.subscribe((address) => void received.push(address));
    return { received, unsubscribe };
  }

  it('asks the system for the launch address once, however often it is needed', async () => {
    const linking = new FakeLinking(LINK);
    const port = createCallbackPort(linking);
    listen(port);

    await port.initialAddress();
    await port.initialAddress();
    linking.emit(OTHER_LINK);
    await settle();

    expect(linking.initialReads).toBe(1);
  });

  it('rejects the read and still delivers links when the launch address cannot be read', async () => {
    const linking = new FakeLinking(null);
    linking.failInitial = true;
    const port = createCallbackPort(linking);
    const { received } = listen(port);

    await expect(port.initialAddress()).rejects.toThrow('The launch address could not be read.');
    linking.emit(LINK);
    await settle();

    expect(received).toEqual([LINK]);
  });

  it('delivers links in the order the system sent them', async () => {
    const linking = new FakeLinking(null);
    const { received } = listen(createCallbackPort(linking));

    linking.emit(LINK);
    linking.emit(OTHER_LINK);
    await settle();

    expect(received).toEqual([LINK, OTHER_LINK]);
  });

  it('keeps a failing listener from costing the others the link', async () => {
    const linking = new FakeLinking(null);
    const port = createCallbackPort(linking);
    port.subscribe(() => {
      throw new Error('listener broke');
    });
    port.subscribe(() => Promise.reject(new Error('listener rejected')));
    const { received } = listen(port);

    linking.emit(LINK);
    await settle();

    expect(received).toEqual([LINK]);
  });

  it('holds one system subscription and releases it with the last listener', async () => {
    const linking = new FakeLinking(null);
    const port = createCallbackPort(linking);
    const first = listen(port);
    const second = listen(port);

    expect(linking.listenerCount).toBe(1);
    first.unsubscribe();
    expect(linking.listenerCount).toBe(1);
    second.unsubscribe();
    expect(linking.listenerCount).toBe(0);

    const third = listen(port);
    linking.emit(LINK);
    await settle();
    expect(third.received).toEqual([LINK]);
  });
});
