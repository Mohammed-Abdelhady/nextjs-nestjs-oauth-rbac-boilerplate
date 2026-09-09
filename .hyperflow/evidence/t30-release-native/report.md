# Native integration release boundary

Status: draft PR created; source writes and release actions stopped. Ready for independent review, not production release.

PR: https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72

Remote head: `3e84f52312196c03aaefc109ceca05c71bebc712`. Base: `master` at `f1d2282d70cf728567fa9877e15176f0ff3705c8`. Local integration branch: `integration/production-hardening`; remote branch: `feat/production-hardening`.

| Commit group            | Commit                                     | Genuine commit hooks |
| ----------------------- | ------------------------------------------ | -------------------- |
| tooling                 | `b095faf33116ce06c18b7d92c85f1b2f14ffbd17` | PASS                 |
| backend                 | `d70220ae656e62e508bf0b5ecd0dfe645d92c62b` | PASS                 |
| frontend                | `bb4f584731b755ffa556e936c2d516f50f46959a` | PASS                 |
| generator               | `88c8a4a7a0e51b509605bddc611776030fb3f2c8` | PASS                 |
| docs                    | `47107002a1ddc5f79177fa5ff7c771998f3591ea` | PASS                 |
| approved EOF formatting | `3e84f52312196c03aaefc109ceca05c71bebc712` | PASS                 |

## Candidate and scope

The independent repository contains 852 tracked files and the exact authorized 804-path delta: 802 projected paths plus the two curated reports. GitHub reports 795 changed entries with renames; expanding previous filenames yields the same 804 paths. No legacy coordination files or their local commit ancestors were published. The original branch and HEAD remain unchanged; all 847 checked non-secret files outside `.hyperflow/` retain their original hashes. The approved environment example also remains unchanged in the original checkout.

All four dependency importer directories were copied, and all 90 dependency links resolve within the candidate. Node 22.18.0/npm 10.9.3 and a clean allowlisted environment were used. Husky was installed through the existing prepare lifecycle; `.husky/_` dispatchers are executable, and tracked hook/config bytes match the source. No hooks or signing policy were weakened. Git used the existing identity and normal credential helper without exposing credentials.

## Gates and corrections

| Gate                                             | Final result                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| Candidate `npm run lint` and `npm run typecheck` | PASS                                                                |
| Candidate `npm run test`                         | PASS: backend 708/708, frontend 123/123, CLI 99/99                  |
| Candidate `npm run build`                        | PASS: all workspaces, 43 frontend routes                            |
| Candidate generated combinations                 | 9/9                                                                 |
| Candidate `npm pack` and `npm publish --dry-run` | PASS; no upload/publication                                         |
| Actual Git pre-push hook                         | PASS: lint, types and all workspace tests                           |
| Exact tree/path/mode and `git diff --check`      | PASS                                                                |
| Publication links                                | 115 relative file/heading links checked; curated 137 rows unchanged |
| Normal push and remote verification              | PASS; remote SHA equals candidate                                   |
| Draft PR creation and hosted path parity         | PASS                                                                |

The first root test run failed 16 CLI feature-runtime cases because the integration runner placed TMPDIR beneath the original repository, causing temporary snippets to inherit its ES-module package scope. Moving only TMPDIR to an owned system-temp directory with no package ancestor resolved the failures; previous logs are retained. No application source change was made for this setup issue.

Genuine hooks formatted three Markdown files: `frontend/e2e/README.md` and the two curated reports. Each result exactly matches the installed Prettier output from the accepted source. Root separately approved removing exactly one trailing newline byte from `backend/.env.example`; a sixth commit records that candidate-only formatting change. No configuration values changed.

API72 and browser112 evidence is reused from identical application/fixture sources on the same supported runtime. Four operational configuration files differ from the earlier application snapshot as expected from the separately accepted T30 work; no Docker runtime evidence is inferred from this comparison. Candidate package and combination checks were rerun after integration formatting.

## Handoff and limits

The initial hosted snapshot has five jobs in progress: quality, analyze, scaffold-combinations, backend and browser integration, and docker. This is not a hosted CI pass. Root owns further CI status and independent review coordination. The separate security review remains blocked; no paused candidate was investigated or repaired. Docker/helper-listener denials and production TLS limits remain unchanged. No merge, deployment, tag or actual package publication occurred.

No integration service was started. Dedicated ports 3107/5107/5108 are free, all gate/push/PR processes exited, and the candidate worktree is clean. The candidate, runtime, dependencies and owned temporary directory are retained for review and authorized repairs. Source is frozen.

Exact commands/results and local evidence: `gates.json`, `corrected-gates.json`, `package-gates.json`, `push.json`, `pr.json`, `pr-verification.json`, `candidate-verification.json`, `source-preservation.json`, `publication-check.json`, `hook-formatting.json`, `example-formatting.json`, `cleanup.json`. No release evidence was staged.

`fallback_scope=codex-only` remains unchanged. The prior CLI attempt ended normally before candidate creation; this native continuation had no model/service fallback. The temporary-directory and canonical-path corrections were local integration setup corrections, not control bypasses.

Candidate path: `/var/folders/d1/tk4y3j012j57stv_sy0qpglr0000gn/T/production-hardening-integration-4lfc21qz`.
Final projection SHA256: `eb0f89f1d04fc1802c434694a63ce91671a825772290c60e21a9fd1618b8080e`.
Final Git tree: `af910a9f0f76be863e8630fe0dbdab3cb8822a2c`.
