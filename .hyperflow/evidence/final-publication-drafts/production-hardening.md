# Production hardening

Draft — **NOT READY for release**. This is the 2026-09-08 pre-push verification boundary. The five-path browser/HTTP-contract repair passed bounded independent recheck. Subsequent 320px sessions wrapping and dialog focus repairs pass local checks and await independent recheck. New hosted confirmation remains pending. Security review is blocked. The [137-finding audit ledger](audit-status.md) preserves historical dispositions without implying that all findings are closed.

## Implemented scope

| Plan | Implemented and verified scope                                                                                                                                                                                                                     | Remaining boundary                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| T21  | Disposable API/database fixtures; anonymous and authenticated English/Arabic journeys; lifecycle, session and administration coverage; representative accessibility checks; startup, persistence, navigation, localization and role-filter repairs | 320px sessions wrapping/focus recheck and hosted browser confirmation pending                                  |
| T29b | Authentication feature pruning, generated password enablement, marker boundaries, packed CLI checks, feature-aware API fixtures, generated commands and documentation                                                                              | Bounded rechecks accepted; seven generated selections are representative, not exhaustive provider combinations |
| T30  | CI integration, asynchronous combination runner, filtered Docker context, Compose/nginx transformations, isolated container HTTP probes and bounded browser failure diagnostics                                                                    | SSR probe source recheck passed; hosted HTTP confirmation and production TLS remain unverified                 |

Fixtures use owned disposable databases, synthetic configuration and a nondelivering mail sink. They cover registration, activation, reset, profile save/reload, signout, sessions, role navigation, ordinary allowed/denied administration and soft deletion. Local OAuth fixtures exercise the application's start/callback/session/profile chain with success, cancellation and error recovery. Magic-link cases include valid and explicitly expired fixtures; network cases verify translated errors and both locale transitions.

Authenticated cases use actual per-case login after database resets; reusable `storageState` is not claimed. The full browser harness remains maintainer-only in source, CI and Docker context. Generated projects retain product unit and functional API tests, omit unavailable browser commands and document that boundary.

## Local verification

Checks used official Node 22.18.0, npm 10.9.3 and the retained dependencies from an isolated fresh `npm ci`. That install ran lifecycle scripts and left the lockfile unchanged; the runtime archive checksum was verified. Browser checks used Playwright 1.57.0 and Chrome 152. Real environment files were excluded; process configuration was allowlisted and synthetic.

| Command                                                                                                | Latest result and scope                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                                                         | PASS; all workspaces, latest sessions repair                                                                                                                                                        |
| `npm run typecheck`                                                                                    | PASS; all workspaces, latest sessions repair                                                                                                                                                        |
| `npm run build`                                                                                        | PASS; backend, frontend production and CLI, latest sessions repair                                                                                                                                  |
| `npm run test:config`                                                                                  | 65/65 PASS; current probe/configuration regressions                                                                                                                                                 |
| `npm run test --workspace frontend`                                                                    | 123/123 PASS; latest application changes                                                                                                                                                            |
| `npm run test:e2e --workspace frontend -- --reporter=line,json`                                        | 78/78 PASS; latest authenticated matrix                                                                                                                                                             |
| `npm run test:e2e --workspace frontend -- --config playwright.frontend.config.ts --reporter=line,json` | 44/44 PASS; latest anonymous matrix                                                                                                                                                                 |
| `npm run test`                                                                                         | Earlier accepted boundary: backend 708/708, frontend 123/123, CLI 107/107 and then-current configuration tests passed; backend/CLI unit suites were not repeated for the latest session-only change |
| `npm run test:e2e -w backend -- --runInBand`                                                           | 72/72 PASS, six suites; unchanged backend scope, also passed in the latest observed hosted run                                                                                                      |
| `npm run test:combinations -w create-nest-next-auth`                                                   | 9/9 PASS across seven selections; unchanged generator scope, also passed in the latest observed hosted run                                                                                          |

The latest authenticated run passed **78/78**, and the unchanged anonymous suite passed **44/44** at the prior accepted boundary: 122 cases across those captures, with no skipped or flaky cases and no retries. Six header regressions cover English/Arabic at 1280, 390 and 385px, retaining controls, keyboard skip navigation and the strict document-width assertion. Final geometry matches the viewport at those sizes. Two additional English/Arabic 320px journeys verify full action labels, strict overflow bounds, keyboard/touch refresh, session identity preservation, cancel/Escape focus return and successful confirmation. Earlier representative axe captures passed without WCAG A/AA violations; this is not exhaustive accessibility or AAA proof.

The current HTTP helper passed against actual native English/Arabic SSR documents. Those documents contain localized html/dir, an accessible store-rehydration loading region and Next bootstrap; the login form appears after hydration. Other endpoints in this focused helper check used synthetic responses. Full container HTTP acceptance still requires hosted verification.

Package creation and `npm publish --dry-run -w packages/create-nest-next-auth` passed before the post-PR repairs without uploading files. Later packed CLI tests passed. The publication dry run was not repeated for the latest session-only work; no actual package publication occurred.

## Review and hosted chronology

| Item                             | Observed disposition                                                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR001–FR003, GR001–GR007         | Earlier functional repairs accepted by bounded independent recheck                                                                                                            |
| CI-COMB-01                       | Diagnostic stdout/stderr repair accepted by independent recheck; hosted combinations pass                                                                                     |
| HFR001/HFR002                    | Bounded failure capture and Location-header presence repairs accepted by independent recheck                                                                                  |
| CI-BROWSER-PRODUCT               | Hosted geometry confirmed RTL overflow; local shell/header/skip-link repair passed scoped independent recheck; new hosted confirmation pending                                |
| CI-DOCKER-SSR                    | In-network probes exposed an SSR contract mismatch; corrected helper passed local checks and scoped source recheck; new hosted confirmation pending                           |
| 320px sessions actions and focus | Wrapping retains full labels; the existing dialog trigger restores cancel/Escape focus. Both localized journeys pass; independent recheck and new hosted confirmation pending |
| Security review                  | Blocked by an explicit control rejection; paused findings remain uninvestigated and unclosed                                                                                  |

The latest observed [hosted run, 34227059854](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/actions/runs/34227059854), tested revision `954b99a319d171d8dd488372fda6f4f530440dce` on 2026-09-08, before the five-path repair and subsequent sessions changes. Quality, combinations, 72 API cases and 44 anonymous browser cases passed. Authenticated browsers passed 71/72; the Arabic mobile overflow assertion failed. All images built and four Docker services became healthy. Internal backend/nginx HTTP probes passed, then the English login-document contract failed; Arabic and advertised-method probes were not reached. Owned Docker fixture cleanup completed.

The CodeQL analysis job passed, while its PR gate failed. The summary for revision `954b99a319d171d8dd488372fda6f4f530440dce`, observed on 2026-09-08, reported **31 untriaged alerts: 30 high and 1 medium**. No newer count is claimed. No alert details or validity assessment were investigated. The [live PR checks](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72/checks) may contain results after this dated record.

T30-OP-001 previously passed its named static Docker-context recheck; T30-CLI-002 generated-template regressions and combination gates pass. These bounded results do not close similarly named historical audit rows.

## Remaining limits

The 320px capture showed an actions row wider than its 288px content area. That source was unchanged from the base, but no matched base-runtime capture was made. The subsequent repair passes strict bounds and complete action journeys in both locales; independent acceptance is still pending. This evidence does not prove every viewport or session-data shape.

Local Docker socket and operational helper-listener access were denied; no denied operation was retried. Hosted evidence now establishes image builds, four healthy services, internal backend/nginx health checks and fixture cleanup. It does not establish all application HTTP probes, production TLS or certificate renewal.

Local provider adapters and captured mail establish application integration, not live OAuth protocol conformance, external delivery or passkey hardware behavior. Earlier dependency advisories have not received a new audit or remediation. Historical findings without exact independent closure evidence retain their ledger dispositions.

The PR remains a draft. The 320px independent recheck, new hosted functional gates and blocked security review remain pending. No merge, deployment or package publication occurred.
