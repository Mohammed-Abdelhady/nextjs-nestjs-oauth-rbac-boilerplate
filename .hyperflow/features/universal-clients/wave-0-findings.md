# Wave 0 findings: the open stack (#144 to #149)

| Field    | Value                                                                                   |
| -------- | --------------------------------------------------------------------------------------- |
| Status   | Fixes in progress                                                                       |
| Date     | 2026-10-01                                                                              |
| Reviewed | Static review at pinned SHAs after rebase onto `staging`. Gates run per layer           |
| Totals   | 5 Critical, 14 Warning, 6 Suggestion                                                    |

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

| #   | Sev        | Layer | Location                                                       | Defect                                                                                             | Lane |
| --- | ---------- | ----- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---- |
| 1   | Critical   | #148  | `backend/src/session/utils/request-origin.ts`                  | `Sec-Fetch-Site: same-site` is rejected, which is what a browser sends from port 3000 to port 5000  | w0d  |
| 2   | Critical   | #148  | `backend/src/session/session.module.ts`, authority migration   | `allowedOrigins` is seeded empty and production never writes it                                    | w0d  |
| 3   | Critical   | #148  | `backend/src/auth/guards/browser-proof.guard.ts`               | A stale session cookie on a public route forces the session branch, so sign-in returns 403         | w0d  |
| 4   | Critical   | #148  | `frontend/src/store/api/baseApi.ts`                            | A spent pre-session proof is reused, the second anonymous POST returns 403                         | w0e  |
| 5   | Critical   | #146  | `backend/src/session/session.module.ts`, schemas, migrations   | Schema indexes and migration indexes share keys with different names, boot or migrate fails        | w0c  |
| 6   | Warning    | #146  | `backend/src/session/utils/authority-unavailable.ts`           | Raw driver message reaches the client in error details                                             | w0c  |
| 7   | Warning    | #146  | `backend/src/session/services/session-issuance.service.ts`     | Every sign-in writes one shared document, concurrent sign-ins by different users conflict          | w0c  |
| 8   | Warning    | #146  | `backend/src/session/utils/linearizable-query.ts`              | Linearizable reads have no time bound, requests hang instead of returning 503                      | w0c  |
| 9   | Warning    | #146  | `backend/src/session/session-authority.integration.spec.ts`    | File-wide raised test timeout                                                                      | w0c  |
| 10  | Warning    | #148  | `backend/test/browser-proof.e2e-spec.ts`                       | The replay test passes with the spend removed                                                      | w0d  |
| 11  | Warning    | #148  | `frontend/src/modules/users/api/usersApi.test.ts`              | The fake returns the wrong payload for the proof endpoint, the test proves nothing about it        | w0e  |
| 12  | Warning    | #147  | `frontend/src/components/ui/LocalizedToastMessage.tsx`         | The namespace change is untested across the interceptor handoff                                    | w0f  |
| 13  | Warning    | #147  | `frontend/src/modules/auth/utils/__tests__/errorCodeMessage.test.ts` | A hand-kept file list stands in for the real loader                                          | w0f  |
| 14  | Warning    | #149  | `backend/src/session/utils/current-session-authority.ts`       | Native access tokens never validate, the deadline helper requires a browser session purpose        | w0b  |
| 15  | Warning    | #149  | `backend/src/auth/guards/browser-proof.guard.ts`               | Bearer requests still need a browser proof, native mutations are rejected                          | A1   |
| 16  | Warning    | #149  | `backend/src/session/native/native-token.service.ts`           | Two code exchanges in parallel can exceed the session cap                                          | A1   |
| 17  | Warning    | #149  | `backend/src/session/native/native-refresh.service.ts`         | A lost refresh response revokes the legitimate device                                              | F    |
| 18  | Warning    | #149  | `backend/src/session/native/native-refresh.service.ts`         | Refresh skips the epoch check and returns a pair that cannot be used                               | A1   |
| 19  | Warning    | #149  | `backend/src/session/native/native-oauth.controller.ts`        | Redirect goes to `/login`, a route that does not exist. No page consumes the transaction           | A2   |
| 20  | Suggestion | #149  | `backend/src/session/native/native-credential.issuer.ts`       | A normal revoke is recorded as a refresh replay                                                    | A1   |
| 21  | Suggestion | #149  | native flag checks                                             | The flag stops issuance only, existing credentials keep working                                    | A1   |
| 22  | Suggestion | #146  | authority migration `down`                                     | Throws when an index is already gone                                                               | w0c  |
| 23  | Suggestion | #146  | `session-authority.service.spec.ts`                            | The 503 mapping is not tested on the guard path                                                    | w0c  |
| 24  | Suggestion | #148  | `frontend/src/store/api/baseApi.ts`                            | Any response body with `data.token` overwrites the proof                                           | w0e  |
| 25  | Suggestion | #148  | `browser-proof.en.json`, `browser-proof.ar.json`               | The origin error talks about sign-in on every kind of request                                      | w0e  |

Finding 1 is confirmed by reading the code and not yet reproduced in a browser. It is reproduced as part
of the real-environment check before the merge.

## Review depth

- Read in full by the reviewers: the authority, issuance, revocation and proof services, all session
  schemas, the migration, both guards, the proof client and its tests, the message overlays.
- Not reviewed: OAuth, passkey and two-factor callers of `createSession`, the #144 controller decorator
  changes, `frozen-clock.ts`.
- No hard-ban token on any added line in the six layers. No file over 350 lines.
