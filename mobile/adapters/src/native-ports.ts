import type { AuthPorts } from '@app/native-auth';
import { CREDENTIALS_KEY_PREFIX, INSTALL_ID_KEY } from './constants';
import { storageKey } from './logic/storage-key';
import { createAuthBrowserPort } from './ports/auth-browser';
import { createCallbackPort } from './ports/callbacks';
import { createClockPort } from './ports/clock';
import { createCredentialsPort } from './ports/credentials';
import { createCryptoPort } from './ports/crypto';
import { createInstallPort } from './ports/install';
import { createTimerPort } from './ports/timer';
import type {
  ClockApi,
  CryptoApi,
  LinkingApi,
  MarkerFileApi,
  SecureStoreApi,
  SecureStoreOptionsApi,
  TimerApi,
  UuidApi,
  WebBrowserApi,
} from './types/modules';

/** The native modules and platform globals a shell hands in. Nothing is imported here. */
export interface NativeModules<TAlgorithm, THandle> {
  secureStore: SecureStoreApi;
  /** Applied to the record and the install id alike. */
  keychainOptions: SecureStoreOptionsApi;
  webBrowser: WebBrowserApi;
  crypto: CryptoApi<TAlgorithm>;
  sha256Algorithm: TAlgorithm;
  linking: LinkingApi;
  installMarker: MarkerFileApi;
  uuid: UuidApi;
  clock: ClockApi;
  timers: TimerApi<THandle>;
}

export interface NativePortSettings {
  clientId: string;
  environment: string;
  /** The engine hands the browser port the authorize address only. */
  redirectUri: string;
  ephemeralBrowserSession: boolean;
}

/** Builds the engine's seven ports. Call it once per app start. */
export function createNativePorts<TAlgorithm, THandle>(
  modules: NativeModules<TAlgorithm, THandle>,
  settings: NativePortSettings,
): AuthPorts {
  return {
    credentials: createCredentialsPort(
      modules.secureStore,
      storageKey(CREDENTIALS_KEY_PREFIX, settings.clientId, settings.environment),
      modules.keychainOptions,
    ),
    authBrowser: createAuthBrowserPort(modules.webBrowser, {
      redirectUri: settings.redirectUri,
      ephemeralSession: settings.ephemeralBrowserSession,
    }),
    crypto: createCryptoPort(modules.crypto, modules.sha256Algorithm),
    callbacks: createCallbackPort(modules.linking),
    clock: createClockPort(modules.clock),
    timer: createTimerPort(modules.timers),
    install: createInstallPort(
      { store: modules.secureStore, marker: modules.installMarker, uuid: modules.uuid },
      INSTALL_ID_KEY,
      modules.keychainOptions,
    ),
  };
}
