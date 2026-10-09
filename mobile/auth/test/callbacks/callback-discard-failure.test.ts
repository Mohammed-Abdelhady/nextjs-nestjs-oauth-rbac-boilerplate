import { describe, expect, it } from 'vitest';
import { BROWSER_AUTHORIZATION_TIMEOUT_MS } from '../../src/constants';
import { createAuthEngine } from '../support/engine';
import {
  CONFIG,
  Deferred,
  ScriptedTransport,
  oauthTokenReply,
  redirectFrom,
  successUserReply,
  testPorts,
} from '../support/support';

describe('failed transaction discard', () => {
  it.each(['cancelled', 'deadline'] as const)(
    'does not accept a late callback after a %s discard could not delete storage',
    async (ending) => {
      const transport = new ScriptedTransport();
      const ports = testPorts(transport);
      const opened = new Deferred<string>();
      ports.authBrowser.beforeOpen = (address) => opened.resolve(address);
      ports.authBrowser.results.push(() =>
        ending === 'cancelled' ? { kind: 'cancelled' } : new Promise(() => undefined),
      );
      ports.credentials.beforeDelete = () => Promise.reject(new Error('keychain unavailable'));
      transport.respond = async ({ path }) => {
        if (path === '/api/oauth/token') return oauthTokenReply();
        if (path === '/api/user/profile') return successUserReply();
        return { status: 200, body: {} };
      };
      const engine = createAuthEngine(CONFIG, ports);
      await engine.restore();
      const signIn = engine.signIn();
      const address = await opened.promise;
      if (ending === 'deadline') ports.timer.fireDelay(BROWSER_AUTHORIZATION_TIMEOUT_MS);

      await expect(signIn).resolves.toMatchObject({ kind: 'storageFailure' });
      ports.credentials.beforeDelete = undefined;
      await expect(engine.restore()).resolves.toMatchObject({ status: 'signedOut' });

      await ports.callbacks.deliver(redirectFrom(address, { code: 'abandoned-code' }));

      expect(transport.sent.filter(({ path }) => path === '/api/oauth/token')).toHaveLength(0);
      expect(ports.credentials.value).toContain('"transaction":');
      expect(engine.snapshot).toMatchObject({ status: 'signedOut', operation: 'none' });
      engine.dispose();
    },
  );
});
