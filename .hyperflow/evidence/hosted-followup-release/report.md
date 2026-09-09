# CI followup release

Status: **NOT READY**. The accepted six-path patch was committed and pushed normally through genuine hooks. No new source changes followed the hosted failures.

| Release check                 | Result                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Commit                        | `954b99a319d171d8dd488372fda6f4f530440dce`                                                                    |
| Parent pin                    | `fc19e55e4f2ae1978c19178e1078c76b47acfa2d` matched before push                                                |
| Accepted patch fingerprint    | `848666e146c79f11292447b80c0290239fb794fc91a10e5a03725b82812a9a0c`                                            |
| Genuine commit/pre-push hooks | PASS; lint, types, root suites                                                                                |
| Local suite counts            | Backend 708; frontend 123; CLI 107; configuration 43                                                          |
| Generated configuration suite | 43/43 at accepted repair boundary                                                                             |
| Remote/PR head                | Matches commit; PR72 OPEN/DRAFT                                                                               |
| Candidate status              | Clean                                                                                                         |
| Original source               | 734 projected source files verified unchanged; original HEAD remains 68cefb61f450b94c195a8d6cf325ac5e26c15349 |
| PR body                       | Updated to current hosted results and revision-pinned report links                                            |

## Hosted result

[Run 34227059854](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/actions/runs/34227059854) completed on 2026-09-08.

| Gate                            | Result                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Quality: lint/types/build/tests | PASS                                                                                                    |
| Scaffold combinations           | PASS                                                                                                    |
| Backend integration             | 72/72 PASS                                                                                              |
| Anonymous browsers              | 44/44 PASS                                                                                              |
| Authenticated browsers          | 71/72 PASS; one failure; zero skipped/flaky                                                             |
| Docker                          | Images built; four healthy services; frontend-en document probe failed; owned fixture cleanup completed |
| CodeQL                          | Analysis job PASS; PR gate FAIL; summary 30 high/one medium; no details inspected                       |

### Browser evidence and proposed next scope

Only the named `integration-overflow-diagnostics` artifact was retrieved, containing `overflow-geometry.json` and `overflow-failure.png`. The screenshot was inspected. Counts came from `integration-counts`; no traces, cookie/session/storage or Docker build artifacts were downloaded.

The single failing case is Arabic mobile, “supports localized session navigation and keyboard controls without overflow.” Its original strict assertion failed without an extra diagnostic timeout. Geometry shows viewport 390, document 392, direction RTL. The dashboard flex column, header, main and sessions page measure 391.84375px and extend to x=-1.84375. The sr-only skip link occupies x390–391. All 296 elements were scanned without truncation; five crossed the viewport. The screenshot shows the session page and crowded single-row header.

Source-backed hypothesis: the dashboard's `flex-1` child retains `min-width:auto`; the mobile header's intrinsic contents force its minimum width beyond the viewport. The locale skip link has no unfocused inset and independently crosses the viewport edge. These remain proposed causes pending controlled geometry verification, not accepted product fixes.

Proposed bounded repair: dashboard shell/header sizing and locale skip-link positioning only, preserving every control and focus behavior. Verify en/ar desktop/mobile, focused and unfocused skip-link visibility, all controls, and unchanged strict overflow. Do not hide overflow or relax the assertion.

### Docker evidence and proposed next scope

The failure is now `frontend-en: login document contract` during container HTTP probes. Sequential execution proves backend and nginx health probes completed; the English frontend response had 200 and no Location header before the semantic check. Arabic frontend and advertised-method probes were not reached. All four services were healthy, and owned fixture removal was logged.

The helper currently requires a literal `<form` in raw HTTP. Root layout wraps children in ReduxProvider; its PersistGate initially renders the accessible `store-rehydration-loading` region. Thus a hydrated form is not the established SSR contract. Before repair, capture only the permitted native app's nonsecret SSR shape if needed. Proposed helper/test change: validate localized html/dir, the actual accessible SSR shell and bootstrap, rejecting blank/error/wrong-locale documents; retain real hydrated-form proof in browser integration. No local Docker or denied helper-listener retry.

## Evidence and boundaries

`commit.log`, `push.log`, their result JSON files, `commit.json`, `preflight.json`, `remote-pr.json`, `source-preservation.json`, `ci-final.json`, `browser-counts.json`, `api-counts.log`, `docker-functional.log`, `browser-functional.log`, `codeql-counts.json`, `pr-body-final.md`, `boundary.json` and the two named artifact files preserve this boundary.

No owned process remains. Candidate/runtime are retained for the next authorized batch. No merge, deployment or package publication occurred. Existing real environment/credential files stayed inaccessible. Security review and alert details remain blocked; production TLS and live provider/mail/hardware verification remain outside fixture evidence. `fallback_scope=codex-only` persists.
