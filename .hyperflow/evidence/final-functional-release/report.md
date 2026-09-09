# Final functional repair release

Status: **functional CI PASS; release NOT READY**. The accepted repairs were committed and pushed normally. Security review remains blocked and the separate CodeQL PR gate remains unresolved. No new source change followed the hosted run.

| Release item                | Result                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| PR                          | [72](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72), OPEN/DRAFT |
| Final local/remote/PR head  | `9e502f9ee0e36c8f9c164fc05a03161c689f374f`, all match                                                |
| Expected parent pin         | `954b99a319d171d8dd488372fda6f4f530440dce`, verified before staging and normal push                  |
| Accepted source fingerprint | `b16a0fc5a6f122c475ba761629d0aa4fa475255889305eb40a92774d73b3d620`                                   |
| Source scope                | Exact seven accepted paths, plus two curated reports                                                 |
| Candidate                   | Clean; retained for any later authorized work                                                        |
| Original checkout           | 847 nonsecret files unchanged; original HEAD remains `68cefb61f450b94c195a8d6cf325ac5e26c15349`      |
| Audit ledger                | All 137 rows preserved exactly; no new historical closure inferred                                   |
| PR body                     | Current hosted results and two actual revision-pinned report links verified                          |

## Commits and hooks

Three Conventional Commits separate independently verified work:

- `614434d9562a05c88fd137f1d928174d8288176f`: responsive controls, sessions wrapping and dialog focus, with browser regressions.
- `bc256e03276726fd9e7043e27d83229c01959df4`: localized SSR contract and probe regressions.
- `9e502f9ee0e36c8f9c164fc05a03161c689f374f`: dated pre-push verification and audit reports.

All commit hooks passed. Source hashes remained exact. The report hook changed only production-report formatting; comparing its output with Prettier applied to the staged input proved exact formatter parity. The audit rows and report cross-links remained intact.

The normal push ran genuine `npm run lint && npm run typecheck && npm run test` hooks and exited 0. Backend 708, frontend 123, CLI 107 and configuration 65 tests passed. No hook bypass, force push, empty commit, tag, merge, deployment or package publication occurred.

## Current hosted evidence

[CI run 34232151880](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/actions/runs/34232151880) completed successfully on 2026-09-08 at the final revision. All four functional jobs passed.

| Hosted gate               | Result                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Quality                   | Lint, types, production builds and tests PASS                                             |
| Backend unit              | 708/708 PASS, 83 suites                                                                   |
| Frontend unit             | 123/123 PASS                                                                              |
| CLI unit                  | 107/107 PASS                                                                              |
| Configuration regressions | 65/65 PASS                                                                                |
| Scaffold combinations     | 9/9 PASS across seven generated selections                                                |
| Backend integration       | 72/72 PASS, six suites                                                                    |
| Anonymous browsers        | 44 executed, 44 passed; zero failed/skipped/flaky                                         |
| Authenticated browsers    | 78 executed, 78 passed; zero failed/skipped/flaky                                         |
| Docker                    | Images built, four services healthy, exact five HTTP checks passed, owned fixture removed |
| CodeQL analysis           | PASS in run 34232151876                                                                   |
| Separate CodeQL PR gate   | FAIL; current-head summary reports 30 high and one medium untriaged alerts                |

The browser counts come from the named `integration-counts` artifact, whose sole `counts.json` file was retained as `integration-counts.json`. No browser failure artifact was produced or needed. No raw cookie, session, storage, trace or Docker build artifact was downloaded.

Docker logs record startup completion, aggregate HTTP success, then owned-fixture removal. At this exact revision, success is printed only after `validateProbeResults` accepts the exact ordered set `backend-health`, `nginx-health`, `frontend-en`, `frontend-ar`, `auth-methods`. Each probe requires status 200 with no Location header and its semantic contract. Thus the aggregate log plus the pinned validator establishes all five successes; the log does not contain individual response bodies or separate per-probe success lines. The successful Compose wait establishes readiness of the four fixture services. This is synthetic HTTP/container coverage, not production TLS or certificate-renewal proof.

Only CodeQL check-summary/count metadata was inspected. The analysis job and failed PR gate are distinct. No alert details, validation, remediation or retry of the rejected independent security review occurred.

## Publication and preservation

The two published reports describe their dated pre-push boundary. Their only status refresh from accepted drafts records the accepted 320px layout/focus recheck. The PR body records the later hosted success, preserves NOT READY and links to both reports at the final pushed revision. `report-link-verification.json` confirms the remote blobs match the candidate commits; `pr-final.json` confirms the actual body and OPEN/DRAFT state.

`source-preservation.json` recomputes the established original-source inventory: 847 nonsecret product files, unchanged SHA-256 aggregate `8b280bb0f91e365d280a06409309f3b5f109767a761f62111eb965be005b6b04`, serialized with the same default JSON rows method. Existing real environment files and credential paths were excluded. No original product file was edited.

## Stopped boundary

`cleanup.json` confirms ports 3107, 5107 and 5108 are free. All release/metadata command sessions ended; no local service was started for this release. Hosted fixture cleanup passed. Candidate and Node 22 runtime are retained, and write ownership is released.

The final tree/path inventory is in `release-manifest.json`; `boundary.json` records the clean matching heads and remaining release limit. Commit and push logs/results, current CI job metadata, browser/API/unit counts, Docker functional log and CodeQL summary counts are retained alongside this report.

Production TLS, live provider accounts, delivered mail and hardware passkeys remain outside fixture evidence. Previously denied local Docker/helper-listener operations were not retried. The 137 historical ledger dispositions remain qualified: 22 blocked, 102 needing independent re-review, 10 unmapped and three verified within named test scope. No claim that all 137 findings are closed. `fallback_scope=codex-only` and the existing security controls persist.
