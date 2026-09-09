# PR 72 functional repair assignment

Responsible owner: existing native Astra specialist `reconcile_claude_progress`. No recursive delegation. User authorized completing remaining work, opening PR and fixing issues after independent review. This batch authorizes implementation and verification only; commit/push follow after root accepts independent recheck.

## Boundary

Work ONLY in candidate `/var/folders/d1/tk4y3j012j57stv_sy0qpglr0000gn/T/production-hardening-integration-4lfc21qz`, starting head `3e84f52312196c03aaefc109ceca05c71bebc712`, base `f1d2282d70cf728567fa9877e15176f0ff3705c8`, PR 72. Preserve original source checkout and history. Evidence belongs in original `.hyperflow/evidence/post-pr-functional-repair/`. You are not alone; preserve others' work. No other writer currently owns candidate. Read current checkpoint and both post-PR review reports.

Root confirms FR001–FR003 and GR001–GR007 against pinned revision, current requirements and supplied source traces. Runtime closure remains pending. This is one targeted repair round for these confirmed review findings. Separately diagnose and repair the three ordinary hosted CI failures in run 34210159665; do not suppress assertions or gates.

| Finding    | Required outcome and acceptance evidence                                                                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR001      | Roles pagination returns to a valid page after deleting the last item; disposable 21-to-20 boundary, remaining rows reachable, empty/first/last cases.                                                                                  |
| FR002      | User role filter can reach every role with bounded pagination/search; later-page role selection produces intended user query, no fixed large-limit workaround.                                                                          |
| FR003      | ARCHITECTURE discovery example matches actual frontend AuthMethodsResponse, including data.methods and provider objects; type/contract evidence.                                                                                        |
| GR001      | Both Compose frontend listeners explicitly match port 3000 despite shared backend PORT; synthetic configuration regression; smoke fixture must not mask actual contract.                                                                |
| GR002      | CLI next steps use docker compose --env-file .env.docker; exact printed output regression.                                                                                                                                              |
| GR003      | Production nginx helper uses current listener/virtual-host structure and chosen domains; both existing configs and repeated transformation fixtures. No certificates/live TLS.                                                          |
| GR004      | Init helper backend port transformation updates current /health probe in both Compose files; default 5001/custom-port fixture checks.                                                                                                   |
| GR005      | Retained generated API provider expectations follow selected providers, preserving full-template expectations. Google-only generated fixture assertion and allowed API verification.                                                    |
| GR006      | README manual startup commands exist in corresponding manifests.                                                                                                                                                                        |
| GR007      | Generated README documentation links resolve for default and pruned selections.                                                                                                                                                         |
| CI-COMB    | Nine assertions pass but Vitest onTaskUpdate RPC times out. Diagnose source/runner cause and verify; do not ignore unhandled errors.                                                                                                    |
| CI-BROWSER | 67/68 authenticated cases pass; Arabic mobile keyboard/overflow test at authenticated-regressions.spec.ts83 expects true/receives false. Obtain precise failing assertion and fix cause with stable observable checks, no sleeps/skips. |
| CI-DOCKER  | Hosted smoke frontend unhealthy, backend/Mongo healthy. Diagnose source/config/logs; permitted existing hosted CI will verify after normal push. Do not retry denied local Docker/socket or helper listener checks.                     |

Ownership: finding files in frontend roles/users page, toolbar and narrow associated pagination/query helper/tests; docs/ARCHITECTURE.md; docker-compose.yml/docker-compose.prod.yml; scripts/verify-docker.mjs/setup-production.js/init.js and narrow pure transformation tests/helpers; CLI next-steps/sync-template/tests; backend/test/constants/oauth-boot-env.ts and app.boot.e2e-spec.ts; README.md; existing combination test runner/config; authenticated-regressions.spec.ts and narrow fixture/config implicated by evidence. Necessary adjacent paths require a concrete scope update to root before edits. Package manifests may only gain needed test command wiring; no dependency upgrades. Reports update after final results.

Assess architecture, scale/time/space/I/O and boundary/failure/recovery cases within scope, use existing patterns, apply Code Simplifier and integrated Unslop/Humanizer. Run appropriate lint/types/unit/API/browser/CLI/combinations/build gates under retained official Node22.18.0. Synthetic TMPDIR must be owned system temp without original package ancestor. Keep genuine hooks intact. Return exact commands/results, hashes, source preservation, changed paths, findings disposition and remaining limits. Freeze candidate when ready for independent recheck. No commits/push yet.

## Persistent controls

fallback_scope=codex-only from historical Sept5 Antigravity T18 no-route failures; no Antigravity retry, no cheaper Astra fallback. Native specialist available; previous CLI DNS was environment failure, not model failure. User permits tracked environment examples and disposable synthetic env fixtures ONLY. Real env/credentials/certificates remain blocked.

Original security-review control rejection remains blocked. Do not retry/rephrase/reassign that review or investigate retained-cookie zero-counter passkey replay, concurrent TOTP scalar acceptance, non-user-verified passkey, admin reactivation/soft-delete security, or security audit rows. No new activation/deactivation/reactivation journeys. CodeQL check reports 31 untriaged alerts (30 high/1 medium); status only, no alert annotations/details or repair investigation through this batch. Keep draft/NOT READY.

Docker socket denial and helper HTTP listen EPERM are unresolved controls: no retry/escalation/alternate route. Existing permitted native app fixture/browser servers are distinct and allowed; normal existing hosted CI on authorized PR push is allowed, no contrived bypass. TLS material remains blocked.

Both completed readonly post-PR reviewers encountered macOS xcrun temporary cache write denials while Git/source reads returned exit0 and verified clean pinned state. Their processes stopped normally; no denied cache-write retry/escalation is authorized or needed. No source mutation was reported.
