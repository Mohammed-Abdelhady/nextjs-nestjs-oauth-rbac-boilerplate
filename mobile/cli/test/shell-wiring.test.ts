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
} from '@app/native-adapters/testing';
import { describe, expect, it, vi } from 'vitest';
import { createShellAuth } from '../src/shell';

async function loadDevelopmentConfiguration() {
  vi.stubGlobal('__DEV__', true);
  try {
    return await import('../src/config');
  } finally {
    vi.unstubAllGlobals();
  }
}

function createModules() {
  const time = new FakeTime();
  return {
    secureStore: new FakeSecureStore(),
    keychainOptions: { keychainAccessible: 4 },
    webBrowser: new FakeWebBrowser(),
    crypto: new FakeCrypto(),
    sha256Algorithm: FAKE_SHA256,
    linking: new FakeLinking(null),
    installMarker: new FakeMarkerFile(),
    recordMarker: new FakeMarkerFile(),
    uuid: new FakeUuid(),
    clock: time,
    timers: time,
    http: new FakeServer(),
  };
}

describe('bare shell adapter wiring', () => {
  it('forwards the shell identity and private browser return settings to the shared factory', async () => {
    const modules = createModules();
    const { AUTH_CONFIGURATION, EPHEMERAL_BROWSER_SESSION } = await loadDevelopmentConfiguration();
    expect(AUTH_CONFIGURATION.serverBaseAddress).toBe('http://localhost:5001');
    expect(AUTH_CONFIGURATION.clientId).toBe('native-app');
    expect(AUTH_CONFIGURATION.environment).toBe('development');
    expect(AUTH_CONFIGURATION.redirectUri).toBe('mobilecli://auth/callback');
    expect(EPHEMERAL_BROWSER_SESSION).toBe(true);
    const auth = createShellAuth(modules, {
      configuration: AUTH_CONFIGURATION,
      ephemeralBrowserSession: EPHEMERAL_BROWSER_SESSION,
    });
    try {
      await auth.engine.restore();
      expect([modules.installMarker.present, modules.recordMarker.present]).toEqual([true, false]);
      modules.webBrowser.steps.push({ kind: 'resolve', result: { type: 'cancel' } });
      const outcome = await auth.engine.signIn();

      expect(outcome).toEqual({ kind: 'cancelled' });
      expect(modules.secureStore.calls).toContainEqual({
        call: 'get',
        key: 'auth.native-app.development',
        options: { keychainAccessible: 4 },
      });
      expect(modules.webBrowser.opened[0]?.redirectUrl).toBe('mobilecli://auth/callback');
      expect(modules.webBrowser.opened[0]?.options).toEqual({ preferEphemeralSession: true });
    } finally {
      auth.engine.dispose();
    }
  });
});
