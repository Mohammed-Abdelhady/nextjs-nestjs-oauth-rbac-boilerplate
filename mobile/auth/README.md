# @app/native-auth

`@app/native-auth` is a TypeScript sign-in engine for Expo and bare React Native shells. It uses
`@app/sdk` for OAuth and API requests. It contains no UI or platform adapter.

## Shell ports

- `credentials`: read the one versioned record, replace it atomically, and delete it. A replace or delete resolves `done`, or `locked`, `cancelled` or `unavailable` when it did not happen.
- `authBrowser`: open the system sign-in browser with the authorize address and the return address the engine passes, and report its redirect, cancellation, dismissal, or failure.
- `crypto`: return random bytes and SHA-256 digests as `Uint8Array` values.
- `callbacks`: subscribe to warm links and read the cold-start address, answering `address`, `none` or `unavailable`.
- `clock`: return wall time and monotonic elapsed time in milliseconds.
- `timer`: schedule a callback after a duration and return its cancel function.
- `install`: return an install id from storage that is not backed up or restored to another device, or say that the storage is `locked` or `unavailable`.
- `deviceKey` (optional): keep an ES256 private key in secure hardware and return its public JWK or sign bytes.

### Port contract details

Storage results. A read answers `found`, `missing`, `locked`, `cancelled`, `corrupt` or `unavailable`.
`corrupt` also covers a record the platform discarded on its own: an adapter over a store that
answers "nothing there" for both cases keeps a plain marker beside the record, written on replace
and removed on delete, and reports `corrupt` when the record is gone while the marker remains. The
engine deletes a `corrupt` record and signs out with the reason `invalidRecord`. A replace or delete
that did not happen resolves with the reason and leaves the stored record as it was. The engine also
treats a rejection as a failed write, but an adapter should not rely on that.

Install identity. `locked` means the device has to be unlocked, and restore then returns
`storageBlocked` with the reason `locked`. `unavailable` means the storage is broken or out of
reach, and restore returns `installUnavailable`. Neither deletes the record.

Launch address. `unavailable` means the read failed. The engine does not mark the read as done and
asks again on the next `restore()`, so a sign-in that returns to a cold app is not lost while its
saved transaction is still valid. A read that passes its deadline stays pending, and a later restore
takes its answer. An adapter must still hand a launch address over once in total.

Browser. The engine passes the validated return address with every `open(address, redirectUri,
signal)`, so an adapter keeps no copy of it. `cancelled` and `dismissed` are best effort: iOS
reports a session that could not be shown as a cancel, and Android reports a person closing the tab
as a dismissal. The engine treats the two alike and only passes the kind on in the sign-in outcome,
so an app must not branch on the difference. After an abort the adapter ends the session for the
engine, but the browser may stay visible, because Android cannot close the tab.

The install id must survive app restarts on one device and must change after a reinstall or device
restore. Use device-only keychain storage on iOS and the no-backup files directory on Android. If the
id is backed up, a copied credential record can look like it belongs to this install. If the id is
lost on a normal restart, the person will be asked to sign in again.

The credentials adapter must namespace its one-record key by client id and environment. A record
from another build is deleted during restore, so sharing an unscoped key can sign out the other build.
Use one engine instance per credential store. Two live engines can rotate the same refresh token;
the second then invalidates the first engine's saved family.

The shell also passes `makeTransport(baseAddress)`, which returns an `@app/sdk` `Transport`. Forward
request headers and signals, omit cookies, and do not let caller headers replace the JSON content
type. Join the base origin and request path by concatenation after the origin. Do not use URL
resolution, which can treat a path as a new host. The engine builds abort signals without a global
controller, and the transport must honor them. Set a deadline on ordinary API requests too. The
engine bounds OAuth exchange, profile loading, refresh, storage, and revoke. If an ordinary API
request never settles, that request stays pending. A later response cannot be retried after sign-out.
The SDK forwards DPoP request headers and exposes the DPoP-Nonce response header on OAuth errors.
The transport must return that response header in `headers`. Without it a device-bound session
cannot answer the server's nonce challenge, and sign-in, refresh and revoke all end at the challenge.
Web callers do not add proofs or change their requests.

Sign-out calls `oauth.revoke` with the refresh token. The bearer logout route also ends the native
session family, but it needs an access token that may already have expired. Revocation works with the
refresh token and ends that same family, including its access credentials. Both routes leave other
native families and browser sessions alone. Revocation has a deadline and is never retried.
If sign-out begins before restore has loaded a record and that record cannot be read, the result says
`recordUnavailable`; the engine does not claim that revocation was unnecessary.

A local record binds the schema, server, environment, client id, a digest of the install identity,
and a random lineage id for the sign-in session. While a sign-in is pending it also stores the PKCE
verifier, state, exact return address, creation and expiry times, and operation id. After sign-in, it
stores the refresh token and lineage id. The lineage id stays local and is carried unchanged through
refreshes. The access token stays in memory and a restored session refreshes before its first protected
request. A marker is saved before each rotation. Refresh failures follow this policy:

When `deviceKey` is configured, code exchange, refresh, and revoke carry a fresh DPoP proof signed
with that key. The session record stores its public-key thumbprint, while the private key remains in
the shell's secure hardware. Ordinary API requests stay bearer requests. A nonce challenge is retried
once with the same OAuth request and a fresh proof id. A second challenge ends that operation.

Only a bound refresh gets one extra send after an unknown answer. It uses the same refresh token and
a fresh proof. The server can return one replacement pair while that retry window remains open and
the replacement has not been used. If the answer is `NATIVE_DPOP_RETRY_IN_PROGRESS`, `invalid_grant`,
or unknown again, the engine asks for sign-in. Unbound sessions never get this retry.

### Offline with an expired access token

This is a product decision. A refresh that gets no answer ends a session that has no device key.
`fetch` reports a request that never left the device and an answer lost on the way back the same
way, so the engine cannot tell them apart. If it sent the same refresh token again and the first
request had arrived, the server would read the second one as reuse of a spent token and revoke the
whole family.

What the person sees: the access token has expired, the app makes a request with no connection, and
the snapshot becomes `reauthRequired` with the reason `refreshInterrupted`. The request rejects with
`TransportError` and the reason `no_response`. The saved marker keeps that state after a restart, so
the person signs in through the browser again once online. A request made offline while the access
token is still valid only fails with `no_response` and the session stays.

A device-bound session gets one resend. The engine sends it at once, inside the same 15 second
refresh deadline, with the same refresh token and a fresh proof. If the device is still offline the
resend is lost too, and the session ends the same way.

An unavailable key is transient, so the engine keeps the bound session and lets the caller try again.
Cancellation, key invalidation, or a thumbprint mismatch makes that session unusable and asks for
sign-in. A new sign-in attempts a quiet revoke of the old family. If its old key is gone, the revoke
cannot be signed and the old family remains until its server expiry.

| Server result                                                                                         | Stored record and snapshot                                                                                                                                                         | May the old refresh token be sent again?                                       |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `invalid_grant`, `invalid_client`, or `unauthorized_client` with `NATIVE_AUTH_DISABLED`               | Delete the record and become `signedOut`.                                                                                                                                          | No                                                                             |
| Any other OAuth error, including `server_error`, `temporarily_unavailable`, or an unknown code        | Keep the marker, clear tokens from memory, and become `reauthRequired`.                                                                                                            | No. The retry exception is for no response or a non-OAuth 5xx.                 |
| No response or refresh deadline                                                                       | Keep the marker, clear tokens from memory, and become `reauthRequired`.                                                                                                            | No. A bound session may make one proof-bearing retry after an unknown outcome. |
| `429 RATE_LIMIT_EXCEEDED`, including a response with no body (the SDK maps a bare `429` to this code) | Clear the marker, keep `signedIn`, and fail the waiting requests with the throttle error. Later requests share one retry after a 30 second backoff.                                | Yes, once after the backoff. The server refused before rotation.               |
| `429` with another code or no matching throttle code                                                  | Keep the marker, clear tokens from memory, and become `reauthRequired`; rotation cannot be ruled out.                                                                              | No                                                                             |
| `503 AUTHORITY_UNAVAILABLE` application response                                                      | Clear the marker, keep `signedIn`, and fail the waiting requests. Later requests share one retry after a 30 second backoff because this code means the transaction did not commit. | Yes, once after the backoff.                                                   |
| `503 TRANSACTION_OUTCOME_UNKNOWN` application response                                                | Keep the marker, clear tokens from memory, and become `reauthRequired`. The server cannot confirm whether rotation committed.                                                      | No. A bound session may make one proof-bearing retry.                          |
| Other non-OAuth HTTP failure, including a bodiless 5xx or a code paired with the wrong status         | Keep the marker, clear tokens from memory, and become `reauthRequired`; rotation cannot be ruled out.                                                                              | No                                                                             |

After disposal, the engine classifies a stored record as `OWN_SAME`, `OWN_OTHER`, `FOREIGN`, `EMPTY`,
or `UNREADABLE`. `OWN_SAME` means the exact token and lineage are stored, so the record stays and the
token is not revoked. `OWN_OTHER` means a token in the same lineage is stored and differs from both
the late token and the token this engine sent, including a successor's in-flight marker. That family
stays and the late token is not revoked. `FOREIGN` includes records with a missing or different
lineage, and same-lineage records whose stored token equals the token this engine sent. For
`FOREIGN` or `EMPTY`, the late token is revoked and any stored record is left unchanged. `UNREADABLE`
triggers one bounded retry. If both reads fail, the token is revoked and one session-guarded delete is
queued. That delete runs only if a later ownership read succeeds and still matches the revoked token.
If the later read also fails, the record stays on disk.

Restore reports `reauthRequired` for a token record without a lineage and leaves it on disk. The next
sign-in starts a quiet revoke of that stored refresh token before replacing the record.

A `session` guard matches only the record with the same server, environment, client id, install digest,
lineage, and refresh token. It also matches an in-flight marker for that token. A refresh guard
additionally requires the marker. A marker write that lands after disposal stays a marker unless its
token already has a claimed revoke intent, in which case a guarded correction removes it. A remaining
marker makes the next restore require sign-in, and that sign-in quietly revokes the old family. A
replace already inside the storage port cannot be cancelled.

After the token record is written, disposing the engine makes `signIn()` return `disposed` while the
saved session remains available. If `signOut()` has started, disposing the engine preserves its
session-guarded local delete and raw OAuth revocation request through their existing deadlines. The
public sign-out promise may already have resolved as `disposed` while cleanup finishes.

For loopback redirects, choose the listener port before creating the engine and pass the exact
URI using `localhost`, a `127.0.0.0/8` address, or `[::1]` with that port as `redirectUri`.
The server accepts a registered loopback host and path at any port during authorization, then
requires the exact runtime address during code exchange. In production, custom-scheme redirects also
require `AUTH_NATIVE_ALLOW_CUSTOM_SCHEME=true` on the server.

## State

Status and operation are separate snapshot fields.

| Status           | Meaning                                                          | Common next state                                              |
| ---------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `restoring`      | Reading the saved record and any cold-start link.                | `signedOut`, `signedIn`, `reauthRequired`, or `storageBlocked` |
| `signedOut`      | No usable session is active.                                     | `authorizing` during sign-in                                   |
| `signedIn`       | A token pair is available in memory.                             | `refreshing` when a request needs a new access token           |
| `reauthRequired` | A refresh may have rotated on the server without a saved answer. | `authorizing` during a new sign-in                             |
| `storageBlocked` | Storage or install identity is temporarily unavailable.          | `restoring` on a later restore call                            |

| Operation     | Meaning                                                           |
| ------------- | ----------------------------------------------------------------- |
| `none`        | No auth operation is running.                                     |
| `authorizing` | A PKCE transaction is saved and the system browser is open.       |
| `exchanging`  | A validated callback is consumed and its code is being exchanged. |
| `refreshing`  | One refresh is shared by requests that need it.                   |
| `signingOut`  | Local credentials are cleared while server revocation runs.       |

Snapshots are immutable. `warning: 'storageBlocked'` means the store refused a write. It is set in
three cases, and the snapshot does not say which:

- `signedIn` after a refresh: the rotated pair could not be saved and is only in memory.
- `signedIn` after a refresh that was not sent: the marker write before it was refused. Nothing
  rotated and the saved record is unchanged.
- `signedOut`: sign-out could not delete the saved record. Nothing is in memory and the old record
  is still on disk.

A shell tells the first two apart by whether a refresh request left the device. With the reason
`storageLocked` the store refused the write because the device is locked: call `restore()` after
unlock and the engine saves the pair it holds, without another refresh. Without that reason the
engine does not try again until the next refresh writes its marker.

## Outcomes for the UI

- Restore returns `restored`, `storageBlocked`, or `disposed`. The `storageBlocked` reason is `locked`, `cancelled`, `unavailable`, `installUnavailable` or `deviceKeyUnavailable`. `locked` covers a locked record, a locked install identity and an owed delete the locked store refused.
- Refresh returns `refreshed`, `notSignedIn`, `disposed`, or `failed` with the error a waiting request would have received.
- Sign-in returns `signedIn`, `alreadySignedIn`, `signedOut`, `disposed`, `cancelled`, `dismissed`, `expired`, `invalidCallback`, `cryptoFailure`, `clockFailure`, `browserFailure`, `authorizationDenied`, `disabled`, `deviceBindingRequired`, `deviceKeyFailure`, `oauthFailure`, `throttled`, `transportFailure`, `aborted`, `apiFailure`, or `storageFailure`.
- Sign-out returns `signedOut` or `disposed`. Its revocation result is `notNeeded`, `recordUnavailable`, `revoked`, `failed`, or `timedOut`.
- API requests can reject with `AuthSessionError`, `AuthDisposedError`, `UnsafeRequestPathError`, `DeviceKeyAuthError`, `DeviceBindingRequiredError`, `ApiError`, `OAuthError`, or `TransportError`. `TransportError.reason` is `aborted` or `no_response`.
- Read the snapshot `reason` after failures and show the `warning` when present.

`refresh()` asks for a new token pair now, whether or not the access token has expired. It joins the
refresh a request already started, and a request that needs a refresh joins it, so one refresh
request is sent. It follows the same policy table, backoff and storage rules as an automatic refresh.

After `dispose()`, pending public calls settle as `disposed`, subscriptions are removed, and the
transport refuses new requests. Disposing does not sign out an established session.

The engine can still call its ports after `dispose()` returns. A timer does not outlive its own
deadline, but timers and port calls do outlive the engine when disposal lands during a refresh or a
sign-out. For a refresh the engine starts no new call later than 35 seconds after `dispose()`: 15
for the answer (`OAUTH_REFRESH_TIMEOUT_MS`), 5 to save it (`CREDENTIAL_WRITE_TIMEOUT_MS`), 5 for the
two ownership reads (`DISPOSED_RECORD_READ_ATTEMPTS` times `DISPOSED_RECORD_READ_ATTEMPT_TIMEOUT_MS`),
5 for the revoke (`SIGN_OUT_REVOKE_TIMEOUT_MS`) and 5 for the ownership reads of the guarded delete.
A sign-out interrupted by disposal runs its guarded delete and its revoke side by side, for up to 5
seconds. One case has no bound: a storage write that answers after its own deadline is corrected
when it answers. A host that tears down its native modules should wait those 35 seconds, or accept
that the late calls fail. During refresh, the engine keeps the deadline armed. `OWN_SAME` keeps the exact rotated token without revoking it.
`OWN_OTHER` keeps a token from that lineage only when it differs from both the late token and the
sent token. `FOREIGN` or
`EMPTY` revokes the late token and leaves any foreign record unchanged. `UNREADABLE` retries once; if
both reads fail, the engine revokes the late token and queues a session-guarded delete. A marker write
that lands after disposal stays a marker unless a revoke intent was claimed for its token, in which
case a guarded correction removes it. No refresh was sent, and a remaining marker makes the next
sign-in quietly revoke that family. Definitive OAuth failures and known non-rotating responses change
storage only while their original marker still matches. The shell still owns deadlines for ordinary API requests. During
sign-out, disposal preserves the guarded local delete and raw OAuth revoke through their deadlines. If
sign-out's delete and revoke both fail, a restart can read the old record; the current engine retries
an owed delete on restore.

Known limits:

- Credential storage has no compare-and-swap. Another engine can replace a record between its
  ownership read and a guarded write or delete.
- A newer session's record is never overwritten by an older operation within one engine instance,
  which orders its writes in one queue. Two instances share no queue. A replace already inside the
  storage port when disposal lands can still overwrite the record a second engine saved for a newer
  sign-in. The newer session can be lost, and its refresh family may stay live until expiry. Build a
  new engine only after the old one's storage calls have returned.
- An abandoned sign-in whose transaction discard failed is remembered only in the current process.
  After restart, a late link may still be exchanged by the original browser session.
- A record without a lineage stays on disk until a later sign-in replaces it. Its refresh token stays
  valid until that sign-in's quiet revoke or expiry.
- A rotated token held only in memory after a storage failure is not revoked by `dispose()`. It stays
  valid on the server until expiry. A locked store does not change this: the save is retried only by
  a live engine, on `restore()` or at its next refresh.
- A late rotated token that a disposed engine cannot save is revoked whatever the reason, a locked
  store included. A disposed engine holds nothing in memory to save later.
- The engine learns that the device was unlocked only when the app calls `restore()`. Call it when
  the app returns to the foreground.
- A launch address the port keeps reporting as `unavailable` is asked for on every restore. The
  saved transaction still expires after six minutes, and the sign-in is lost then.
- If revocation fails, the token remains alive until expiry. If sign-out's delete also fails, a
  restart can read the old record until the owed deletion succeeds.

The engine does not load a profile during restore. A profile from the current engine instance is
preserved, while a process restart restores tokens with no profile. Fetch the profile through the
SDK before showing account details after a restart.

The browser-return URL is checked against the configured scheme, host, port, and path. A malformed
URL returned by the browser ends sign-in as `invalidCallback`. A link from the app callback port
that is not this transaction is ignored. A saved, unexpired transaction can accept a warm link while
restore is loading or after restore completes without a cold-start address.

The engine backs off for 30 seconds after `429 RATE_LIMIT_EXCEEDED` or `503 AUTHORITY_UNAVAILABLE`, using
the timer and monotonic clock ports. The SDK does not expose a retry hint, so the engine uses its
fixed backoff. Requests arriving during that interval wait on one shared retry. Sign-out and caller
abort release their waiters and cancel the timer.

`AuthPortError` reports a deadline or failure from an engine port. The SDK client preserves this
typed error so a shell can distinguish storage and timer failures from a network failure.
`CredentialStoreError` is the `AuthPortError` for a write or delete the store refused. Its
`condition` is `locked`, `cancelled` or `unavailable`, and it is the `error` of a `storageFailure`
sign-in outcome, a sign-out whose delete failed, and a refresh stopped before it was sent.

The entry also exports `PortAbortController`, the controller behind the signals the engine passes to
its ports, for a shell or test that needs to build one.

## Adapter conformance suite

`@app/native-auth/conformance` checks a shell's port adapters against the contracts above. It is a
separate entry, so the engine's main entry carries no test code. It uses no test framework and no
platform API, and runs the same way in a unit test or on a device.

```ts
import { runConformance } from '@app/native-auth/conformance';

const results = await runConformance({ adapters, driver });
expect(results.filter((result) => !result.ok)).toEqual([]);
```

`adapters` holds the shell's `credentials`, `authBrowser`, `crypto`, `clock`, `timer` and `install`
adapters. `driver` is the part only a test harness can do: lock the store, fail the next write,
refuse every write for a reason, drop the stored record the way a platform does, end the next
browser session a given way, start the app from a link, fail that start's first launch read, deliver
a link, let time pass, move the wall clock, and make the install identity unreadable or locked. The
callbacks adapter comes from
`driver.callbacks.launch(address)`, one per app start, because a cold-start address exists before the
adapter does. `driver.reset()` runs before each check and `driver.settle()` resolves once work the
adapters already started has finished.

Each result names its check, such as `credentials.locked` or `callbacks.same-address-both-ways`, and a
failed one carries the reason. Five rules go beyond the port types. A launch address that the system
repeats as a link event is handed over once in total. A blocked read reports why and is never
`missing`. A record the platform discarded reads as `corrupt`, and as `missing` once it is deleted. A
refused write or delete resolves with its reason and never rejects. After a launch read that failed,
the next read hands the address over.

`authBrowser.abort` checks that the adapter ends the session, through `driver.authBrowser.isOpen()`.
A tab the platform cannot close does not count as an open session.

The suite does not cover `DeviceKeyPort`, a change of install identity after a reinstall, or two
replaces racing each other.

## Device-bound guarantee and limits

With a configured device key, an intercepted refresh token is not enough to rotate the family. The
caller must also use the matching private key for a fresh proof. A lost bound-refresh answer gets at
most one proof-bearing retry. The guarantee now reads: a refresh token is never sent twice, except
once more with proof for a bound session after an unknown outcome.

The replacement from that retry is the only replacement the server can return for the lost answer.
If the retry answer is also lost, or the server says a replacement is already in progress, sign-in is
required. If the key is lost or invalidated, the engine cannot use the bound session or sign a revoke
for it. That session remains valid on the server until its idle or absolute expiry. `DeviceKeyPort` is
optional for existing clients and shells that can provide a secure-hardware implementation can enable
it.
