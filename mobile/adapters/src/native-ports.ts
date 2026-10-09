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
  RecordMarkerApi,
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
  /** Named by `recordMarkerFile`, beside the install marker. */
  recordMarker: RecordMarkerApi;
  uuid: UuidApi;
  clock: ClockApi;
  timers: TimerApi<THandle>;
}

export interface NativePortSettings {
  clientId: string;
  environment: string;
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
      modules.recordMarker,
    ),
    authBrowser: createAuthBrowserPort(modules.webBrowser, {
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
