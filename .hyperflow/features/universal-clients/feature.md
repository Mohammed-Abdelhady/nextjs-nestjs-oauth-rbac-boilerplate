# Universal clients

| Field              | Value                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| Status             | Plan v2, agreed after two debate rounds. Wave 0 in progress                      |
| Date               | 2026-10-01                                                                       |
| Integration branch | `staging`, cut from `master` at `3a71d76`                                        |
| Delivery           | Stacked PRs on `staging`, merged dependency-first, each green on its own SHA     |
| Client targets     | Web (Next.js), React Native under Expo, React Native under the bare CLI          |
| Database targets   | MongoDB (today), PostgreSQL (milestone 3)                                        |
| Verified on        | iOS simulator and a real browser. Android is typechecked and unit tested only    |

## TL;DR

One NestJS API serves pluggable clients. The web app keeps HttpOnly cookie sessions. A React Native app
ships as two thin shells, Expo and bare CLI, over one shared native core, and signs in with the
authorization code flow and PKCE through the system browser, with tokens bound to a device key. The
installer asks which clients, which database and which features to generate. The existing native stack
(#144 to #149) is repaired first, because review found it does not work in a real browser.

## Scope at a glance

- In: repair of the open stack, browser continuation for native sign-in, device-bound tokens, shared
  contracts and client, two native shells, a target-aware installer, PostgreSQL adapter.
- Out for now: real app attestation (App Attest, Play Integrity), MySQL and SQLite, native passkey
  ceremonies inside the app, Android device verification on this machine.

## Decisions

| ID  | Decision                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Shared code lives in top-level workspaces. `shared/core` holds error codes, permission constants and helpers, platform-neutral validators, domain types, message catalogues. `packages/` stays for the installer. File validators that depend on `File` stay in the web app.            |
| D2  | `shared/sdk` holds typed request and response contracts plus a small transport-independent client. Each app keeps its own RTK Query wrappers and cache. Web injects the cookie transport, native injects the device-bound bearer transport.                                              |
| D3  | Native is `mobile/core` plus two shells, `mobile/expo` and `mobile/cli`. Both shells are proven with a minimal sign-in before shared screens are built. Expo needs a development build, not Expo Go.                                                                                     |
| D4  | Native sign-in follows RFC 8252. The app opens the system browser on the authorize endpoint with S256 PKCE and state. The app never handles a password.                                                                                                                                 |
| D5  | Device key is one Turbo Native Module, `mobile/device-key` (Swift and Kotlin, New Architecture), used by both shells. It reports the protection of the actual key as `secure-element`, `tee` or `software`. The software tier is refused in production unless a deployment opts in.     |
| D6  | Tokens are bound with DPoP (RFC 9449) for access and refresh. The server validates the proof before it interprets a replay, so a leaked token alone cannot log its owner out. Nonce handling, bounded clock skew and `ath` on resource requests are part of the first DPoP PR.          |
| D7  | Refresh recovery after a lost response returns the exact original successor response, stored encrypted for a short window, only for a valid proof from the bound key, and only while that successor is still current and unrevoked. Outside the window the app signs in again.          |
| D8  | `AUTH_NATIVE_ENABLED=false` is a kill switch. It blocks authorization start, approval, access validation and refresh, and returns an error clients do not retry.                                                                                                                       |
| D9  | Redirects use claimed `https` links in production (Android App Links, iOS associated domains). A private-use scheme is allowed only when the application record opts in. Association failure is a denial, never a silent downgrade.                                                     |
| D10 | Persistence moves behind operation-level ports with an explicit transaction boundary, after DPoP lands on Mongoose. The rotation, recovery and revocation contracts are defined before DPoP so the PostgreSQL adapter implements the same atomic operations.                           |
| D11 | PostgreSQL uses Drizzle on `pg`, separate from the Mongo adapter. One contract suite runs against both with real databases. Expiry never depends on a sweeper alone.                                                                                                                   |
| D12 | The installer resolves targets, database and features as explicit dependencies. Native-only still generates the sign-in website, because the browser half of native sign-in lives there. npm is the supported package manager at first.                                                |

## Browser continuation (new work, missing from the existing stack)

`GET /api/oauth/authorize` redirects to a localized page, `/{locale}/auth/native/authorize?transaction=…`.
Signed out, the user goes through the normal sign-in with a validated continuation. Signed in, the page
confirms the account and application on first authorization, then approves and returns to the app.
Denial returns `access_denied` with the stored state. The redirect validator is changed to normalize the
locale prefix and allow this one continuation route. Magic-link sign-in binds the continuation to the
magic-link record, so it survives a different browser. An expired transaction restarts the flow.

## PR stack

| PR  | Scope, verifiable on its own                                                                              | Depends on | Implementer |
| --- | --------------------------------------------------------------------------------------------------------- | ---------- | ----------- |
| A0  | Repair #144 to #148: findings from the layer reviews (see `wave-0-findings.md`)                           | none       | all three   |
| A1  | Repair #149: token validation, session cap, refresh epoch, revoke event, proof guard for bearer, kill switch | A0      | Luna        |
| A2  | Browser continuation, protected-route checks with a real bearer token                                     | A1         | Luna, DeepSeek |
| B   | Workspace gates for `shared/` and `mobile/`, installer dependency model, packaging and Docker support     | A2         | Muse, DeepSeek |
| D   | `shared/core` and `shared/sdk`, web consumes them, packed-installer check                                 | B          | DeepSeek, Muse |
| E   | Both shell skeletons, device-key module, browser, link and storage adapters, iOS builds                   | B, D       | Luna, Muse  |
| F   | Backend DPoP with reference-client tests, refresh recovery, rollout policy                                | A2, E      | Luna        |
| G   | Native sign-in, profile, sessions, sign-out in both shells, target-aware installer                        | D, E, F    | Luna, Muse  |
| C   | Persistence ports with Mongo parity                                                                       | F          | Luna        |
| H   | PostgreSQL adapter, migrations, installer database choice, concurrency parity                             | C, B       | Luna, DeepSeek |
| I   | Remaining screens (roles, settings), biometric gate, key-loss recovery                                    | G          | Muse, Luna  |

Milestone 1 is A0 to A2. Milestone 2 is B to G. Milestone 3 is C and H. I follows.

## How work moves

1. The lead writes a brief with file ownership. An implementer writes and never commits.
2. The lead reads the diff, greps added lines for hard bans, and reruns the gates on that SHA.
3. A specialist reviewer reads the same SHA without the lead's opinion: security and data safety, test
   honesty, or frontend and RTL, by risk.
4. Every Critical, Warning and Suggestion returns to the implementer as a delta brief. Steps 2 and 3
   repeat until a pass is clean.
5. The lead commits by concern, folds corrections into the commit they belong to, and pushes the PR.
6. Before any merge to `staging`: the compose stack, the web app in a real browser, and both native
   shells on the iOS simulator.

## Known limits

- Android is not run on a device or emulator on this machine. It is reported as unverified.
- The protection tier reported by the device-key module is a hint. The server cannot enforce hardware
  policy until attestation exists.
- A device whose signer is available to an attacker (rooted, or a stolen software key) is outside what
  DPoP protects.
