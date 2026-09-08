# Production hardening

Draft — **NOT READY for release**. Local verification completed on 2026-09-08. Independent rechecks accepted FR001–FR003, GR001–GR007 and CI-COMB-01 within their bounded criteria. Local gates pass; hosted confirmation remains pending at the dated pre-push boundary below. Security review remains blocked. The [137-finding audit ledger](audit-status.md) preserves historical dispositions without implying that all findings are closed.

## Completed local scope

| Plan | Implemented and locally verified                                                                                                                                                                                                                                                                         | Remaining boundary                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| T21  | Disposable API/database fixtures; anonymous and authenticated journeys; English/Arabic desktop/mobile lifecycle coverage; representative accessibility checks; startup, navigation, persistence, routing, localization and accessibility repairs; role-pagination recovery and searchable role filtering | Bounded functional recheck complete; live external integrations excluded                                            |
| T29b | Authentication feature pruning and generated password enablement; marker boundary tests; packed CLI and generated combination checks; feature-aware API boot fixtures; corrected generated commands and documentation links                                                                              | Bounded functional recheck complete; seven selections are representative, not every provider combination            |
| T30  | CI integration commands, responsive asynchronous combination runner, bounded browser synchronization, filtered Docker context, disposable runtime helper, current Compose/nginx transformations and complete audit disposition inventory                                                                 | Bounded functional recheck complete; hosted CI rerun pending at this capture; Docker/TLS runtime remains unverified |

Fixtures use an owned disposable Mongo instance, synthetic configuration and a local mail sink. They exercise registration, activation, password reset, profile save/reload, signout, sessions, role navigation, ordinary allowed/denied administration and soft deletion. The local OAuth adapter exercises the application’s start/callback/session/profile chain, including success, cancellation and error recovery. Magic-link cases cover valid and explicitly expired fixtures. Network cases verify translated errors, both locale transitions and recovery.

Authenticated cases sign in through the actual local flow after each reset because resets invalidate sessions; reusable `storageState` is not claimed. The full browser harness remains maintainer-only in source, CI and Docker context. Generated projects retain product unit tests and functional backend API tests, omit unavailable browser commands and document that boundary.

## Current verification

Final repair gates used official Node 22.18.0, npm 10.9.3, Playwright 1.57.0 and installed Chrome 152. A preceding isolated fresh `npm ci` passed with lifecycle scripts enabled and the lockfile unchanged; the runtime archive checksum was verified. This repair reused those dependencies without changing the lockfile.

Commands ran in an isolated copy with real environment files excluded, an allowlisted process environment, empty npm user/global configuration and synthetic application values. Browser fixtures used `NEXT_PUBLIC_API_URL=http://127.0.0.1:5107` and `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome`.

| Command                                                                                       | Latest result                                                                                                                             |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                                                | PASS; all workspaces                                                                                                                      |
| `npm run typecheck`                                                                           | PASS; all workspaces                                                                                                                      |
| `npm run build`                                                                               | PASS; backend, frontend production and CLI                                                                                                |
| `npm run test`                                                                                | PASS; backend 708/708, frontend 123/123, CLI 107/107, configuration/docs 18/18                                                            |
| `npm run test:e2e -w backend -- --runInBand`                                                  | PASS; 72/72, six suites                                                                                                                   |
| `npm run test:e2e -w frontend -- --reporter=list,json`                                        | PASS; 72/72 application cases                                                                                                             |
| `npm run test:e2e -w frontend -- --config=playwright.frontend.config.ts --reporter=list,json` | PASS; 44/44 anonymous cases                                                                                                               |
| `npm run test:combinations -w create-nest-next-auth`                                          | PASS; 9/9 across seven selections, workspace typechecks, runtime feature checks, generated Google-only API boot and full-selection parity |

All **116 browser cases** executed with zero retries and no skipped, unexpected or flaky cases. The earlier lifecycle matrix recorded 16 representative axe captures with zero WCAG A/AA violations; the new English/Arabic role-filter regressions add two passing captures. This does not establish exhaustive accessibility or AAA conformance. Dedicated fixture ports 3107, 5107 and 5108 were free after verification.

Package creation and `npm publish --dry-run -w packages/create-nest-next-auth` passed before the post-PR repair, with no files uploaded. Current packed CLI tests also pass. The publication dry run was not repeated for this repair; no actual package publication is claimed.

## Review and CI status

**Pre-push evidence captured 2026-09-08T10:38:36+00:00.** Hosted statuses below describe the previous run and the unpushed repair at this time. Later results are available in the [live PR checks](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72/checks).

| Item            | Current disposition                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR001–FR003     | Role-page recovery, bounded searchable role filter and advertised-method documentation repaired; local regression gates pass; independent bounded recheck **accepted**                                                         |
| GR001–GR007     | Frontend container binding/probe, generated Compose command, nginx/domain and port transformations, pruned API fixture, startup commands and README links repaired; local gates pass; independent bounded recheck **accepted** |
| CI combinations | Asynchronous child commands preserve timeout/cancel/error behavior and both diagnostic streams; CI-COMB-01 independent recheck accepted; local 9/9 pass without worker RPC errors; hosted rerun **pending**                    |
| CI browser      | Waits for observable sidebar/animation completion before the unchanged strict overflow assertion; full local matrix passes; hosted rerun **pending**. A persistent product overflow defect was not reproduced.                 |
| CI Docker       | Initial hosted run reported an unhealthy frontend. Binding/probe configuration and sanitized diagnostics were updated; pure tests pass. Runtime cause and hosted rerun remain **pending**.                                     |
| Security review | Blocked by an explicit control rejection; paused findings remain uninvestigated and unclosed                                                                                                                                   |
| CodeQL          | **31 untriaged alerts: 30 high and 1 medium**. No alert details or validity assessment were investigated.                                                                                                                      |

T30-OP-001 previously passed an independent static recheck of retained browser imports in the filtered Docker context; its helper checks recorded 20 passes and 13 blocked listener cases. T30-CLI-002 generated-template regressions and combination gates pass. These results establish their named local scope, not full production readiness or closure of similarly named historical audit rows.

## Release limits

Docker socket access and the operational helper’s listener were denied locally. The initial hosted Docker job failed. Actual container health/cleanup, production TLS and certificate renewal remain unverified. No denied operation was retried.

Local provider adapters and captured mail establish application integration, not live OAuth protocol conformance, external mail delivery or passkey hardware behavior. Dependency advisories from the earlier fresh install have not received a new audit or remediation. Historical findings without exact independent closure evidence retain their ledger dispositions.

The PR remains a draft. Bounded functional rechecks are complete. Hosted CI and unresolved security/runtime gates still govern readiness; consult the live PR checks for results after this capture. No package publication, merge or deployment occurred.
