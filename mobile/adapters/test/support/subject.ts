import type { ConformanceDriver, ConformanceSubject } from '@app/native-auth/conformance';
import {
  createNativePorts,
  type NativeModules,
  type NativePortSettings,
} from '../../src/native-ports';
import {
  FAKE_SHA256,
  FakeCrypto,
  FakeLinking,
  FakeMarkerFile,
  FakeTime,
  FakeUuid,
  FakeWebBrowser,
} from './fake-modules';
import { FakeCodedError, FakeSecureStore, IOS_KEYCHAIN_FAILURE } from './fake-store';

const MICROTASK_TURNS = 20;
const SETTINGS: NativePortSettings = {
  clientId: 'native-client',
  environment: 'test',
  ephemeralBrowserSession: true,
};
/** Written by hand: prefix, client id, environment. */
const RECORD_KEY = 'auth.native-client.test';

export interface FakeModules {
  store: FakeSecureStore;
  browser: FakeWebBrowser;
  crypto: FakeCrypto;
  marker: FakeMarkerFile;
  recordMarker: FakeMarkerFile;
  uuid: FakeUuid;
  time: FakeTime;
  linking: FakeLinking | undefined;
  /** How many reads of the next launch's address fail before one works. */
  failingLaunchReads: number;
}

export interface NativeSubject extends ConformanceSubject {
  modules: FakeModules;
}

export async function settle(): Promise<void> {
  for (let turn = 0; turn < MICROTASK_TURNS; turn += 1) await Promise.resolve();
}

function nativeModules(modules: FakeModules, linking: FakeLinking): NativeModules<string, number> {
  return {
    secureStore: modules.store,
    keychainOptions: { keychainAccessible: 4 },
    webBrowser: modules.browser,
    crypto: modules.crypto,
    sha256Algorithm: FAKE_SHA256,
    linking,
    installMarker: modules.marker,
    recordMarker: modules.recordMarker,
    uuid: modules.uuid,
    clock: modules.time,
    timers: modules.time,
  };
}

function driverFor(modules: FakeModules): ConformanceDriver {
  return {
    async reset() {
      modules.store.reset();
      modules.browser.reset();
      modules.marker.present = false;
      modules.marker.unreadable = false;
      modules.recordMarker.present = false;
      modules.time.reset();
      modules.linking = undefined;
      modules.failingLaunchReads = 0;
    },
    settle,
    credentials: {
      async force(condition) {
        modules.store.readFailure = IOS_KEYCHAIN_FAILURE[condition];
      },
      async failNextReplace() {
        modules.store.failNextSet = true;
      },
      async blockWrites(condition) {
        modules.store.writeFailure = IOS_KEYCHAIN_FAILURE[condition];
      },
      async discard() {
        modules.store.discard(RECORD_KEY);
      },
    },
    authBrowser: {
      async script(result) {
        if (result.kind === 'pending') modules.browser.steps.push({ kind: 'pending' });
        else if (result.kind === 'redirect') {
          modules.browser.steps.push({
            kind: 'resolve',
            result: { type: 'success', url: result.url },
          });
        } else if (result.kind === 'cancelled') {
          modules.browser.steps.push({ kind: 'resolve', result: { type: 'cancel' } });
        } else if (result.kind === 'dismissed') {
          modules.browser.steps.push({ kind: 'resolve', result: { type: 'dismiss' } });
        } else {
          modules.browser.steps.push({
            kind: 'reject',
            error: new FakeCodedError('ERR_WEB_AUTH_SESSION_FAILED_TO_START', result.reason),
          });
        }
      },
      lastAddress: async () => modules.browser.opened.at(-1)?.url,
      lastRedirectUri: async () => modules.browser.opened.at(-1)?.redirectUrl ?? undefined,
      isOpen: async () => modules.browser.isOpen,
    },
    callbacks: {
      async failNextLaunchRead() {
        modules.failingLaunchReads = 1;
      },
      // A cold-start address exists before the adapter does, so each launch builds its own.
      async launch(address) {
        modules.linking = new FakeLinking(address ?? null);
        modules.linking.failingInitialReads = modules.failingLaunchReads;
        modules.failingLaunchReads = 0;
        return createNativePorts(nativeModules(modules, modules.linking), SETTINGS).callbacks;
      },
      async deliver(address) {
        modules.linking?.emit(address);
      },
    },
    time: {
      async elapse(milliseconds) {
        modules.time.advance(milliseconds);
      },
      async jumpWall(milliseconds) {
        modules.time.wallOffset += milliseconds;
      },
    },
    install: {
      async makeUnavailable() {
        modules.store.readFailure = IOS_KEYCHAIN_FAILURE.unavailable;
        modules.marker.unreadable = true;
      },
      // A locked keychain refuses reads and writes alike.
      async lock() {
        modules.store.readFailure = IOS_KEYCHAIN_FAILURE.locked;
        modules.store.writeFailure = IOS_KEYCHAIN_FAILURE.locked;
      },
    },
  };
}

/** The ports `createNativePorts` builds, over hand-written fakes of the Expo modules. */
export function nativeSubject(): NativeSubject {
  const modules: FakeModules = {
    store: new FakeSecureStore(),
    browser: new FakeWebBrowser(),
    crypto: new FakeCrypto(),
    marker: new FakeMarkerFile(),
    recordMarker: new FakeMarkerFile(),
    uuid: new FakeUuid(),
    time: new FakeTime(),
    linking: undefined,
    failingLaunchReads: 0,
  };
  const ports = createNativePorts(nativeModules(modules, new FakeLinking(null)), SETTINGS);
  return {
    modules,
    driver: driverFor(modules),
    adapters: {
      credentials: ports.credentials,
      authBrowser: ports.authBrowser,
      crypto: ports.crypto,
      clock: ports.clock,
      timer: ports.timer,
      install: ports.install,
    },
  };
}
