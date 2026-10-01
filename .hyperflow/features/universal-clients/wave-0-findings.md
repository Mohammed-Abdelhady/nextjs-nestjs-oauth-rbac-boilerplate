# Wave 0 findings: the open stack (#144 to #149)

| Field    | Value                                                                         |
| -------- | ----------------------------------------------------------------------------- |
| Status   | 22 of 25 fixed and verified. 3 open, each assigned to a later PR              |
| Date     | 2026-10-01                                                                    |
| Reviewed | Static review at pinned SHAs after rebase onto `staging`. Gates run per layer |
| Totals   | 6 Critical, 13 Warning, 6 Suggestion                                          |

## TL;DR

Every layer below #148 passes lint, typecheck, tests and build on its own. The stack still does not work
in a real browser: the origin check rejects the documented local setup, production has no allowed
origin, and the web client reuses a single-use proof. The native layer issues access tokens that never
validate. None of this was caught by the existing tests.

## Gate results before fixes

| Layer                         | SHA       | lint | typecheck | test | build |
| ----------------------------- | --------- | ---- | --------- | ---- | ----- |
| #144 session-authentication   | `6ae49d7` | 0    | 0         | 0    | 0     |
| #145 session-authority-config | `d4b618d` | 0    | 0         | 0    | 0     |
| #146 session-authority        | `75ce42b` | 0    | 0         | 0    | 0     |
| #147 session-authority-i18n   | `bd23155` | 0    | 0         | 0    | 0     |
| #148 session-browser-proof    | `53a5a68` | 0    | 2         | 1    | 0     |
| #149 native-authorization     | `a3d0b13` | 0    | 2         | 1    | 0     |

#148 changed `createSession` to return an object and left two #146 specs passing it as a string. Repaired
and folded into the causing commit, new head `9cb8f79` (typecheck 0, lint 0, 92 suites, 775 tests).

## Findings

| #   | Sev        | Layer | Location                                                             | Defect                                                                                             | State       |
| --- | ---------- | ----- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Critical   | #148  | `backend/src/session/utils/request-origin.ts`                        | `Sec-Fetch-Site: same-site` is rejected, which is what a browser sends from port 3000 to port 5000 | Fixed       |
| 2   | Critical   | #148  | `backend/src/session/session.module.ts`, authority migration         | `allowedOrigins` is seeded empty and production never writes it                                    | Fixed       |
| 3   | Critical   | #148  | `backend/src/auth/guards/browser-proof.guard.ts`                     | A stale session cookie on a public route forces the session branch, so sign-in returns 403         | Fixed       |
| 4   | Critical   | #148  | `frontend/src/store/api/baseApi.ts`                                  | A spent pre-session proof is reused, the second anonymous POST returns 403                         | Fixed       |
| 5   | Critical   | #146  | `backend/src/session/session.module.ts`, schemas, migrations         | Schema indexes and migration indexes share keys with different names, boot or migrate fails        | Fixed       |
| 6   | Warning    | #146  | `backend/src/session/utils/authority-unavailable.ts`                 | Raw driver message reaches the client in error details                                             | Fixed       |
| 7   | Critical   | #146  | `backend/src/session/services/session-issuance.service.ts`           | Every sign-in writes one shared document, concurrent sign-ins by different users conflict          | Fixed       |
| 8   | Warning    | #146  | `backend/src/session/utils/linearizable-query.ts`                    | Linearizable reads have no time bound, requests hang instead of returning 503                      | Fixed       |
| 9   | Warning    | #146  | `backend/src/session/session-authority.integration.spec.ts`          | File-wide raised test timeout                                                                      | Fixed       |
| 10  | Warning    | #148  | `backend/test/browser-proof.e2e-spec.ts`                             | The replay test passes with the spend removed                                                      | Fixed       |
| 11  | Warning    | #148  | `frontend/src/modules/users/api/usersApi.test.ts`                    | The fake returns the wrong payload for the proof endpoint, the test proves nothing about it        | Fixed       |
| 12  | Warning    | #147  | `frontend/src/components/ui/LocalizedToastMessage.tsx`               | The namespace change is untested across the interceptor handoff                                    | Fixed       |
| 13  | Warning    | #147  | `frontend/src/modules/auth/utils/__tests__/errorCodeMessage.test.ts` | A hand-kept file list stands in for the real loader                                                | Fixed       |
| 14  | Warning    | #149  | `backend/src/session/utils/current-session-authority.ts`             | Native access tokens never validate, the deadline helper requires a browser session purpose        | Fixed       |
| 15  | Warning    | #149  | `backend/src/auth/guards/browser-proof.guard.ts`                     | Bearer requests still need a browser proof, native mutations are rejected                          | Fixed       |
| 16  | Warning    | #149  | `backend/src/session/native/native-token.service.ts`                 | Two code exchanges in parallel can exceed the session cap                                          | Fixed       |
| 17  | Warning    | #149  | `backend/src/session/native/native-refresh.service.ts`               | A lost refresh response revokes the legitimate device                                              | Open, PR F  |
| 18  | Warning    | #149  | `backend/src/session/native/native-refresh.service.ts`               | Refresh skips the epoch check and returns a pair that cannot be used                               | Fixed       |
| 19  | Warning    | #149  | `backend/src/session/native/native-oauth.controller.ts`              | Redirect goes to `/login`, a route that does not exist. No page consumes the transaction           | Open, PR A2 |
| 20  | Suggestion | #149  | `backend/src/session/native/native-credential.issuer.ts`             | A normal revoke is recorded as a refresh replay                                                    | Fixed       |
| 21  | Suggestion | #149  | native flag checks                                                   | The flag stops issuance only, existing credentials keep working                                    | Fixed       |
| 22  | Suggestion | #146  | authority migration `down`                                           | Throws when an index is already gone                                                               | Fixed       |
| 23  | Suggestion | #146  | `session-authority.service.spec.ts`                                  | The 503 mapping is not tested on the guard path                                                    | Fixed       |
| 24  | Suggestion | #148  | `frontend/src/store/api/baseApi.ts`                                  | Any response body with `data.token` overwrites the proof                                           | Fixed       |
| 25  | Suggestion | #148  | `browser-proof.en.json`, `browser-proof.ar.json`                     | The origin error talks about sign-in on every kind of request                                      | Fixed       |

Finding 7 was raised to Critical after measurement: 25 sign-ins at once by different users gave 3
successes before the fix and 25 after.

Finding 1 is confirmed by reading the code and by unit and e2e tests. It is not yet reproduced in a real
browser. That happens in the real-environment check before the merge.

## Found while fixing

| Sev        | Where                                        | Defect                                                                                   | State |
| ---------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- | ----- |
| Critical   | `browser-proof.guard.ts`                     | A signed-in person posting to a public form (forgot password, magic link) got 403        | Fixed |
| Warning    | released migrations                          | Migrating before first start and after it left different indexes on the users collection | Fixed |
| Warning    | session and e2e fixtures                     | Frozen test dates had passed, so the database could expire fixtures mid-test             | Fixed |
| Warning    | `session-authority-list.integration.spec.ts` | Replica set boot had no scoped timeout and failed under parallel load                    | Fixed |
| Warning    | stack order                                  | The health test fix sat two PRs above the change it tests, so #146 and #147 failed e2e   | Fixed |
| Suggestion | `role.schema.ts`                             | The `slug` index is declared twice                                                       | Open  |

## Environment

Node 22 is pinned in `.nvmrc`. The machine used for these runs has Node 24.21 only, which crashed in its
garbage collector three times during test runs (macOS crash reports). Results in this file come from
runs without a crash.

## Review depth

- Read in full by the reviewers: the authority, issuance, revocation and proof services, all session
  schemas, the migration, both guards, the proof client and its tests, the message overlays.
- Not reviewed: OAuth, passkey and two-factor callers of `createSession`, the #144 controller decorator
  changes, `frozen-clock.ts`.
- No hard-ban token on any added line in the six layers. No file over 350 lines.
