# @app/native-adapters

The seven port adapters of `@app/native-auth` over the Expo modules, written once for the Expo shell
and the bare React Native shell. It also holds the `fetch` transport both shells pass to the engine.

The package imports no native module and reads no platform global. The shell that owns
`expo-secure-store`, `expo-web-browser`, `expo-crypto`, `expo-linking` and `expo-file-system` hands
them in. Under pnpm's isolated linker a shared package that listed them itself could resolve a
second copy, and a native module must exist once in an app. The ESLint configuration refuses an
`expo-*` or `react-native` import in `src`, so this stays true.

## Wiring a shell

```ts
import {
  createFetchTransport,
  createNativePorts,
  INSTALL_MARKER_FILE,
  REQUEST_DEADLINE_MS,
} from '@app/native-adapters';
import { createAuthEngine } from '@app/native-auth';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

const ports = createNativePorts(
  {
    secureStore: SecureStore,
    keychainOptions: { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY },
    webBrowser: WebBrowser,
    crypto: Crypto,
    sha256Algorithm: Crypto.CryptoDigestAlgorithm.SHA256,
    linking: Linking,
    installMarker: new File(Paths.document, INSTALL_MARKER_FILE),
    uuid: Crypto,
    clock: { date: Date, performance },
    timers: {
      setTimeout: (handler, milliseconds) => setTimeout(handler, milliseconds),
      clearTimeout: (handle) => clearTimeout(handle),
    },
  },
  { clientId, environment, redirectUri, ephemeralBrowserSession: true },
);

const http = {
  fetch: (address, init) => fetch(address, init),
  createAbort: () => new AbortController(),
};

const engine = createAuthEngine(configuration, {
  ...ports,
  makeTransport: (baseAddress) =>
    createFetchTransport(http, ports.timer, baseAddress, REQUEST_DEADLINE_MS),
});
```

Call `createNativePorts` once per app start. The callbacks adapter reads the launch address when it
is built and remembers what it has handed over, so a second set of ports would hand it over again.

`redirectUri` is a setting because the engine gives the browser port the authorize address only, and
the browser module needs the return address as well. Pass the same value the engine is configured
with.

Add the `expo-secure-store` and `expo-web-browser` config plugins to the app. The first keeps
Android's backup from restoring secure store entries to another device.

## What each adapter guarantees

| Port          | Guarantee                                                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `credentials` | One secure store item named `auth.<client id>.<environment>`, with characters the store refuses escaped. A replace is one write. A read that fails says why and is never `missing`.                               |
| `authBrowser` | Opens one system sign-in session with the return address and the session preference. Abort ends the session and resolves `dismissed`. A rejection becomes `failed` with Expo's error code. It never rejects.      |
| `crypto`      | Random bytes of exactly the length asked. SHA-256 of exactly the bytes given, also when they are a view into a larger buffer. A wrong length from the module rejects.                                             |
| `callbacks`   | The launch address is read from the system once and handed over once in total, by the read or by the link event that repeats it. Links arrive in order. One system subscription, released with the last listener. |
| `clock`       | Wall time from `Date`. Elapsed time from `performance`, never lower than an earlier reading and unaffected by a change of the device clock.                                                                       |
| `timer`       | One platform timer per call, cleared on cancel.                                                                                                                                                                   |
| `install`     | An id in the secure store plus a marker file in the app's documents. The id survives restarts, and a missing marker means a new install and a new id. Any failure is `unavailable`, never a new id.               |

The transport sends no cookies, sets the JSON content type itself, joins the origin and the path by
concatenation, forwards the caller's abort, ends a request at its deadline and resolves every HTTP
status.

## Outcomes the platform cannot tell apart

1. Android removes a stored record it cannot decrypt and answers that there is none. The adapter
   reports `missing`, and nothing records that a session was lost.
2. Android reports a keystore that is briefly out of reach and a record that is gone for good with
   the same error. The adapter reports `unavailable` for both, so a passing fault signs nobody out.
3. The secure store rejects with one error type and puts the cause in the message. The adapter reads
   `locked`, `cancelled` and `corrupt` from that text, as written in `expo-secure-store` 57.0.4.
   Every other cause is `unavailable`. `cancelled` needs the store's authentication option, which
   the shells do not use.
4. A failed write or delete carries no reason. A store that is locked during a write looks like any
   other failed write.
5. On iOS a person closing the sign-in sheet and a session that could not be shown both arrive as
   `cancel`. The adapter reports `cancelled` for both.
6. On Android a person closing the browser tab arrives as `dismiss`, the answer iOS gives for a
   session closed by the app. The adapter reports `dismissed`. Android also cannot close the tab on
   abort: the session ends for the engine while the tab stays open.
7. The install port can only say `unavailable`. The id lives in the same keychain as the record, so
   a locked keychain reaches the engine as a missing install identity and not as a locked store.
8. A marker file without an id is a backup restored to another device, or a keychain item that was
   lost. Both get a new id.
9. A link event equal to the launch address may be the system repeating it or a second delivery.
   The adapter treats only the first event after launch as a possible repeat.

## Tests and fakes

`pnpm --filter @app/native-adapters run test` runs the unit tests and the engine's conformance suite
against these adapters, over hand-written fakes of the module APIs. The fakes copy the real modules'
error text, so a wrong mapping fails.

`@app/native-adapters/testing` exports those fakes, a fake of the local server behind `fetch`, and
`nativeSubject()` for the conformance suite. A shell uses them to test its own wiring without a
device. They are a separate entry and never reach an app bundle.

None of this has run on a device yet. The error text, the order of the launch address and its link
event, and the install id across a reinstall are checked against the module sources and the fakes
only.
