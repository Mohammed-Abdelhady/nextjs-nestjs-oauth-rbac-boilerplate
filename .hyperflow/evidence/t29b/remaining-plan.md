# T21 and T30 execution plan

Prepared 2026-09-08. This is a technical plan; no T21 implementation or browser run was performed in the T29b batch.

| Task | Current evidence                                                                                                                                                          | Next result required                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| T21  | Three frontend specs exist: sidebar navigation, session management and role management. Playwright currently starts only the frontend dev server and runs Desktop Chrome. | Deterministic authenticated fixtures, shared test-ID selectors, rebuilt flows, accessibility, RTL and mobile projects. |
| T30  | Current isolated lint/types/unit/backend build/frontend production build pass. Full CLI gates, backend integration and browser verification are outstanding.              | Complete gate matrix and audit reconciliation, then user-authorized PR integration and independent post-PR review.     |

## Safe T21 subset under current controls

The next independent batch can implement shared selectors/page actions, remove fixed sleeps and stale unlocalized routes, add English/Arabic desktop/mobile Playwright projects, and verify anonymous login/register/reset form rendering, client validation, navigation, keyboard use and overflow. Run the frontend from the permitted isolated copy, with a dedicated port and synthetic process configuration. Stub only advertised-method HTTP responses when needed for frontend rendering tests, and label those tests as frontend-only. This work does not require example templates, live credentials or the blocked review candidates.

Authenticated dashboard/sidebar, sessions and administrator UI coverage needs a deterministic authenticated fixture first. A new disposable database/backend harness can be designed with synthetic process variables and no environment files, but its startup/import order and mail isolation must be verified before it is run. The existing `backend/test/utils/e2e-app.ts` imports `AppModule` immediately and assumes an already configured, seeded database; running those suites unchanged is not a safe fixture plan. Real OAuth-provider access remains unavailable without separately authorized credentials. Candidate challenge/recovery reproductions and security-review repairs stay paused.

## T21 architecture and coverage

Use Playwright fixtures to own a dedicated frontend/backend pair and a disposable seeded database. Reuse the installed MongoDB test tooling where practical. Pass synthetic settings through the process or an explicitly permitted fixture; never load local credentials. Do not reuse an arbitrary existing development server. Give each worker separate database state or serialize tests that mutate shared roles and sessions. Teardown closes servers and databases even when setup or a test fails.

Create ordinary-user and administrator fixtures through the backend's real authentication flow, save their browser storage state under disposable test output, and use fresh contexts for anonymous cases. Keep fixture setup separate from assertions. Shared selectors live in `frontend/e2e/utils/selectors.ts`; page actions should express login, navigation and form submission without hiding assertions or timing failures.

Use a local test mail transport to inspect activation, reset and magic-link messages without delivering them. OAuth tests should use a deterministic local provider/transport boundary and exercise the real application callback flow. Report real-provider live validation separately when external credentials are unavailable. Use a browser virtual authenticator for passkey user journeys. TOTP and recovery journey coverage must wait for the root to resolve the separate review control blocker and assign the allowed scope.

| Flow                          | Required outcomes                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Password authentication       | Register, activate, sign in, sign out, forgot/reset password, invalid/expired input and protected-route redirects. |
| Auth-method discovery         | Render only enabled and generated methods; a disabled selection cannot be reached through navigation.              |
| OAuth and magic link          | Successful callback, cancelled/error callback, missing or expired state/link, clear recovery navigation.           |
| Account settings and sessions | Save changes, validation errors, empty/list states, revoke another session and invalidate the current session.     |
| Administration                | Allowed user/role CRUD, validation, empty/first/last pagination, hierarchy boundaries and denied navigation.       |
| Navigation and accessibility  | Keyboard operation, focus, labels, loading and errors, no overflow; automated axe checks on representative pages.  |

Run each core navigation/form flow in English LTR and formal Arabic RTL, at desktop and mobile widths. Use Chromium first; add the requested browser matrix only when the baseline fixture is stable. Prefer role/test-ID locators and observable state transitions. Avoid sleep-based waits and retries that hide fixture races. Review screenshots and browser errors as well as assertions.

The dominant cost is starting services and preparing browser/database state. Reuse immutable setup within a worker, while isolating mutable test data. Each case should make a bounded number of requests and assertions; no broad polling or exhaustive UI Cartesian product is needed. Exhaust feature-flag decisions at the unit/generated-source level and use representative browser flows for layout and interaction combinations.

## T30 gates and acceptance

1. Finish T29b's complete CLI unit, packed-package and seven generated-project checks after the example-template exception is resolved. Require backend/frontend typechecking, runtime method availability and full-selection source parity.
2. Run backend integration suites against a disposable database with synthetic configuration. Preserve fail-fast startup checks. A successful unit suite is not evidence of database/API integration.
3. Run the rebuilt T21 browser suite against dedicated services. Capture the tested revision, project matrix, counts, screenshots/traces on failure and any external-provider limitation.
4. Run lint, typecheck, all unit suites and the original production build commands after the last source edit. Check disk capacity before browser/build artifacts. Investigate new failures without repeating already passing gates unnecessarily.
5. Reconcile the audit/task table against current code and evidence. Keep unresolved findings, unavailable external tests and the independent security-review control rejection explicit; do not mark them complete from historical commits.
6. Root validates coverage and assigns a bounded integration worker to stage only accepted paths, make Conventional Commits and create the authorized PR. Then perform the separately authorized independent post-PR review. Do not merge or deploy.

The security-review control blocker cannot be retried or bypassed through another session under this plan. It needs resolution by the root before dependent review, candidate reproductions or repairs can proceed.
