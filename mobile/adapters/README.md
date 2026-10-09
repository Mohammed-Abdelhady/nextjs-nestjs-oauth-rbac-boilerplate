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
  recordMarkerFile,
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
    recordMarker: new File(Paths.document, recordMarkerFile(clientId, environment)),
    uuid: Crypto,
    clock: { date: Date, performance },
    timers: {
      setTimeout: (handler, milliseconds) => setTimeout(handler, milliseconds),
      clearTimeout: (handle) => clearTimeout(handle),
    },
  },
  { clientId, environment, ephemeralBrowserSession: true },
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

The engine hands the browser port the return address with every sign-in, so the adapters keep no
copy of it. The record marker is a plain file beside the install marker, named after the client id
and the environment like the record's key, so two builds never share one.

Add the `expo-secure-store` and `expo-web-browser` config plugins to the app. The first keeps
Android's backup from restoring secure store entries to another device.

## What each adapter guarantees

| Port          | Guarantee                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `credentials` | One secure store item named `auth.<client id>.<environment>`, with characters the store refuses escaped. A replace is one write. A read that fails says why and is never `missing`. A write or delete the store refuses resolves `locked`, `cancelled` or `unavailable` and never rejects. A marker file is written after the record and removed after it, and a record that is gone while its marker remains reads as `corrupt`. |
| `authBrowser` | Opens one system sign-in session with the return address the engine passes and the session preference. Abort ends the session and resolves `dismissed`. A rejection becomes `failed` with Expo's error code. It never rejects.                                                                                                                                                                                                    |
| `crypto`      | Random bytes of exactly the length asked. SHA-256 of exactly the bytes given, also when they are a view into a larger buffer. A wrong length from the module rejects.                                                                                                                                                                                                                                                             |
| `callbacks`   | The launch address is handed over once in total, by the read or by the link event that repeats it. A read the system failed answers `unavailable`, and the next read asks the system again. Links arrive in order. One system subscription, released with the last listener.                                                                                                                                                      |
| `clock`       | Wall time from `Date`. Elapsed time from `performance`, never lower than an earlier reading and unaffected by a change of the device clock.                                                                                                                                                                                                                                                                                       |
| `timer`       | One platform timer per call, cleared on cancel.                                                                                                                                                                                                                                                                                                                                                                                   |
| `install`     | An id in the secure store plus a marker file in the app's documents. The id survives restarts, and a missing marker means a new install and a new id. A locked keychain is `locked`, any other failure is `unavailable`, and neither makes a new id.                                                                                                                                                                              |

The transport sends no cookies, sets the JSON content type itself, joins the origin and the path by
concatenation, forwards the caller's abort, ends a request at its deadline and resolves every HTTP
status. It returns the `DPoP-Nonce` response header, which a device-bound session needs to answer
the server's nonce challenge. The `fetch` a shell hands in must expose response headers.

## Offline with an expired access token

This is a product decision of the engine. It applies to every shell that wires no device key.
A refresh that gets no answer ends the session. `fetch` rejects the same way for a request that
never left the device and for an answer lost on the way back, and this transport passes that
rejection on as it came. The engine cannot tell the two apart, and sending an unbound refresh token
twice risks the server revoking the whole family for reuse.

What the person sees: the access token has expired, the app makes a request in airplane mode or a
tunnel, and the status becomes `reauthRequired` with the reason `refreshInterrupted`. It stays that
way after a restart, and the person signs in through the browser again. A request made offline
while the access token is still valid fails and keeps the session.

A shell that wires a device key gets one resend of the refresh, sent at once with a fresh proof. If
the device is still offline, that resend is lost too and the session ends the same way.

## Outcomes the platform cannot tell apart

1. Android removes a stored record it cannot decrypt and answers that there is none. The record
   marker tells that apart from an empty store, and the adapter reports `corrupt`. The engine then
   deletes the record and signs out with the reason `invalidRecord`. The server's token family
   still lives until it expires, because nothing is left to revoke. A marker restored from a backup
   to a device without the record reads the same way. If the marker itself cannot be read, the
   adapter reports `unavailable`. If it could not be written, a discarded record reads as `missing`.
2. Android reports a keystore that is briefly out of reach and a record that is gone for good with
   the same error. The adapter reports `unavailable` for both, so a passing fault signs nobody out.
3. The secure store rejects with one error type and puts the cause in the message. The adapter reads
   `locked`, `cancelled` and `corrupt` from that text, as written in `expo-secure-store` 57.0.4.
   Every other cause is `unavailable`. `cancelled` needs the store's authentication option, which
   the shells do not use.
4. A failed write or delete reads its reason from the same message text as a read. A cause the
   adapter does not know, and a decode failure during a write, are `unavailable`.
5. On iOS a person closing the sign-in sheet and a session that could not be shown both arrive as
   `cancel`. The adapter reports `cancelled` for both.
6. On Android a person closing the browser tab arrives as `dismiss`, the answer iOS gives for a
   session closed by the app. The adapter reports `dismissed`. Android also cannot close the tab on
   abort: the session ends for the engine while the tab stays open.
7. The install id lives in the same keychain as the record and is read first, so a locked keychain
   reaches the engine through the install port. It answers `locked`, and restore reports `locked`.
   An unreadable marker file or any other keychain failure is `unavailable`.
8. A marker file without an id is a backup restored to another device, or a keychain item that was
   lost. Both get a new id.
9. A link event equal to the launch address may be the system repeating it or a second delivery.
   The adapter treats only the first event after launch as a possible repeat. That also holds while
   the launch address is unknown after a failed read: links are delivered as they come, and the
   first one counts as the hand-over if a later read finds it was the launch address.

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
