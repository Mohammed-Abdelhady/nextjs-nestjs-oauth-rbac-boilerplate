import { INSTALL_MARKER_FILE } from '@app/native-adapters';
import type { AuthConfiguration } from '@app/native-auth';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createShellAuth, type ShellAuth } from './shell';

/** The only file that imports the native modules. The shared adapters receive them from here. */
export function createNativeShellAuth(
  configuration: AuthConfiguration,
  ephemeralBrowserSession: boolean,
): ShellAuth {
  return createShellAuth(
    {
      secureStore: SecureStore,
      // Readable in the background after the first unlock, and never copied to another device.
      keychainOptions: { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY },
      webBrowser: WebBrowser,
      crypto: Crypto,
      sha256Algorithm: Crypto.CryptoDigestAlgorithm.SHA256,
      linking: Linking,
      installMarker: new File(Paths.document, INSTALL_MARKER_FILE),
      uuid: Crypto,
      clock: { date: Date, performance },
      timers: {
        setTimeout: (handler: () => void, milliseconds: number) =>
          setTimeout(handler, milliseconds),
        clearTimeout: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
      },
      http: {
        fetch: (address, init) => fetch(address, init),
        createAbort: () => new AbortController(),
      },
    },
    { configuration, ephemeralBrowserSession },
  );
}
