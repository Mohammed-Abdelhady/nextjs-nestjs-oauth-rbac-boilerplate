# Mobile: one core, two shells

| Field      | Value                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| Status     | v2, after debate. Six positions changed, listed under "What the debate changed"           |
| Date       | 2026-10-02                                                                                |
| Depends on | Milestone 1 in `staging`, `shared/core` (D1), native applications from configuration (N1) |
| Reviewed   | Server claims below were checked against `staging` at `2a5f6ef`                           |

## TL;DR

A React Native app that signs in through the browser step built in milestone 1, shows the profile and
sessions, and signs out. Two thin shells, Expo and bare React Native CLI, sit over one auth engine. The
server needs seven small changes before the engine can be honest about its states. Neither shell is
offered by the installer until it has been built and run on a simulator, which this machine cannot do.

## Workspaces

| Path                | Package            | Holds                                                               |
| ------------------- | ------------------ | ------------------------------------------------------------------- |
| `mobile/auth`       | `@app/native-auth` | Auth engine, bearer transport, the ports. No React, no React Native |
| `mobile/ui`         | `@app/native-ui`   | Screens, navigation, catalogues, query hooks. React Native allowed  |
| `mobile/expo`       | app                | Expo shell: port adapters, app config, entry                        |
| `mobile/cli`        | app                | Bare shell: port adapters, native projects, entry                   |
| `mobile/device-key` | `@app/device-key`  | Device-held signing key. Its interface is fixed in E1, built in F   |

Draft v1 had one `mobile/core`. It could not keep its own rule of importing nothing native while
holding screens, so the engine and the screens are separate packages.

## Server changes first (piece S1)

Each was confirmed by reading the code. None is a change to the protocol.

| #   | Today                                                                               | Change                                                                     |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | With mobile sign-in turned off, the token route answers `unauthorized_client`       | Add a distinguishable reason so the app can say why and stop retrying      |
| 2   | Token route failures come in two shapes, and throttling in a third                  | Document the three shapes and test them. The client parses all three       |
| 3   | The sessions list returns browser sessions only and finds "current" from the cookie | Include mobile sessions and identify the current one from the request      |
| 4   | A request carrying both a cookie and a bearer token is authenticated by the cookie  | A bearer token wins when one is sent                                       |
| 5   | A custom-scheme return address is accepted in production with no opt-in             | Production requires an explicit setting to allow a custom scheme           |
| 6   | A loopback return address must match the registered port exactly                    | Any port on a registered loopback host is accepted                         |
| 7   | A new mobile session expires after five idle minutes until its first API call       | Keep, document, and test. The engine calls the profile right after sign-in |

Not changed: the sign-in code lives for 60 seconds and is never retried. A refresh whose answer is lost
still ends the session family. Recovery from that comes with device-bound tokens in F.

## Ports

| Port          | Contract                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `credentials` | Read, replace and delete one versioned record. Outcomes: found, missing, locked, cancelled, corrupt, unavailable. Replace is atomic |
| `authBrowser` | Open an address in the system sign-in browser. Outcomes: redirect, user cancelled, system dismissed, failed. Can be aborted         |
| `crypto`      | Random bytes and a SHA-256 digest of bytes. Tested against the published PKCE vectors                                               |
| `callbacks`   | Cold-start and warm-start return addresses, delivered once each, with unsubscribe                                                   |
| `lifecycle`   | Foreground and background events, with unsubscribe                                                                                  |
| `clock`       | Wall time in milliseconds and a monotonic elapsed time in milliseconds                                                              |

The return address is configuration, not a port. A read error is never treated as "no account".

Adapters. Expo shell: `expo-secure-store`, `expo-web-browser`, `expo-crypto`, `expo-linking`. Bare
shell: the first experiment uses the same Expo modules installed into the bare app, because a
maintained sign-in browser beats one written here. If that fails on the pinned React Native version or
cannot deliver a claimed `https` return address, the bare shell gets its own small native module. The
installer says plainly when the bare app carries Expo modules.

## Auth engine

Session status and the running operation are separate.

- Status: `restoring`, `signedOut`, `signedIn`, `reauthRequired`, `storageBlocked`.
- Operation: `none`, `authorizing`, `exchanging`, `refreshing`, `signingOut`. One at a time.

Rules.

- Before the browser opens, the verifier, state, exact return address, expiry and an operation id are
  saved. A return address that arrives on a cold start finds its transaction. Each transaction is
  consumed once, before the exchange. State is checked on denial too.
- A return address is accepted only if scheme, host, port and path match configuration, it carries no
  credentials or fragment, no parameter is repeated, and it does not carry both a code and an error.
- Refresh: an in-flight marker is saved before the request. The new record replaces the old one
  atomically before any waiting request continues. A marker found at start means the outcome is
  unknown, and the status becomes `reauthRequired`. The old token is never sent again.
- A request that gets a 401 first checks whether a newer token already exists and uses it. Writes are
  not replayed after an unclear network result. A permission failure never triggers a refresh.
- Sign out raises the epoch before its first await, clears memory and cached data at once, then
  revokes on the server with a time limit. An exchange that finishes after sign-out revokes what it
  received.
- Records are scoped by server, environment and client id, and carry an install marker that is not
  backed up. A record restored from a backup or another install is deleted, not used.
- Token lifetime uses the monotonic clock with a safety margin. After a restart the token is treated
  as expired.

## API client

The screens use `shared/sdk`, the typed client both apps share, with the bearer transport injected.
RTK Query wraps it in `mobile/ui` only. Its cache is reset by the same epoch as the engine. Requests
send no cookies.

## Packaging

Decided before E1 is frozen, not left to the implementer: each shared package declares `exports`, React
and React Native as peer dependencies, and each shell has a Metro configuration that resolves one copy
of React from its own workspace. The Expo shell pins the React and React Native pair that its SDK
supports. The web app keeps its own React version.

## Pieces and order

| ID  | Piece                                                                          | Owner    | After                      |
| --- | ------------------------------------------------------------------------------ | -------- | -------------------------- |
| S1  | The seven server changes above, with tests                                     | Luna     | N1                         |
| D2  | `shared/sdk`: typed API client with an injected transport, used by the web app | Muse     | D1                         |
| E1  | `mobile/auth`: ports, engine, transport, fault tests, the device-key interface | Luna     | S1                         |
| X   | Two sign-in experiments, one per shell, adapters only, no screens              | DeepSeek | E1 ports drafted           |
| E2  | `mobile/ui` and the Expo shell                                                 | DeepSeek | X, D2                      |
| E3  | The bare shell                                                                 | Muse     | X, D2                      |
| F   | Device-bound tokens on the server and in the engine, `mobile/device-key`       | Luna     | E1                         |
| E4  | Installer offers the two mobile targets                                        | DeepSeek | E2, E3, F, native evidence |

E1's ports stay a draft until experiment X has signed in on both shells.

## Gates

| Gate                                                                                                | Where                                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| lint, typecheck, unit tests for every mobile workspace                                              | Here                                                                     |
| Engine fault tests: lost answers, storage failures, repeated callbacks, sign-out races, clock jumps | Here                                                                     |
| Engine against the real server, started in the test process                                         | Here                                                                     |
| Metro bundle of each shell. Proves JavaScript resolves, nothing more                                | Here, with dependencies already installed                                |
| iOS simulator build, sign-in, cold-start return, storage, right-to-left                             | A macOS runner in CI, or the owner's machine once CocoaPods is installed |
| Android build and the same checks                                                                   | A Linux runner in CI                                                     |

Status words. "Bundles" means the JavaScript gate passed. "Runs" means it was built and signed in on a
simulator. A shell is merged into `staging` at "bundles" and stays `planned` in the installer until it
"runs" on both platforms.

## What the debate changed

| Question | Draft v1                                | v2                                                             |
| -------- | --------------------------------------- | -------------------------------------------------------------- |
| Q1, Q2   | A different browser library per shell   | One adapter tried in both shells first, own module as fallback |
| Q3       | RTK Query in the core                   | `shared/sdk` in the middle, RTK Query only in the screens      |
| Q4       | Merge on bundle, call it a shell        | Merge on bundle, offer it only after it runs                   |
| Q5       | Five exclusive states                   | Status and operation split, saved transactions, epochs         |
| Q6       | Left to the implementer                 | Exports, peers and Metro resolution decided up front           |
| Order    | Device-bound tokens after the installer | Device-bound tokens before the installer offers mobile         |

## Open

- Whether CI minutes on macOS runners are acceptable is the owner's call. Without them, iOS evidence
  waits for CocoaPods on the owner's machine.
- The bare shell's browser adapter is undecided until experiment X.
