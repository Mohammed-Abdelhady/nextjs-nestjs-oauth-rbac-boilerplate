# CI Docker repair and browser diagnostics

Status: ready for independent scoped recheck; no finding is self-closed. Source is frozen at five paths in `manifest.json`, fingerprint `822ea784c2549dd6fa229f2e7d5d1dd0926b9564065472cb4f15ab823e99c195`, based on `fc19e55e4f2ae1978c19178e1078c76b47acfa2d`. No commit or push occurred.

| Finding    | Implemented result                                                                                                     | Remaining evidence                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| CI-DOCKER  | Internal-network HTTP probes replace incompatible published-port lookups. All original HTTP contracts remain asserted. | Hosted Docker execution and independent recheck                                        |
| CI-BROWSER | Exact failing assertion remains strict. Failure-only geometry and screenshot capture are now retained by CI.           | Actual overflowing element and product cause remain unknown; no product repair claimed |

## Docker behavior

The smoke model retains its sole internal network and removes only smoke-fixture host publication. Product Compose files are unchanged. The helper executes a self-contained Node program in the existing backend container using `compose exec -T backend node --input-type=module -e`. Five fixed service-DNS targets exercise backend health, nginx health, English and Arabic login documents, and enabled authentication methods. No extra image or external network is introduced.

Semantic assertions preserve the health fields, timestamp validity, login language/form, boolean password flag and disabled optional providers. Each request has a 10-second signal, each streamed response is capped at 1 MiB, and the command has a 65-second outer timeout with existing cancellation/process-group cleanup and 1 MiB output limit. Returned output contains only five successful probe names or one allowlisted failure name/reason; response bodies and underlying network errors are not printed. Early non200/redirect responses are cancelled; oversized streams close on iteration exit. The host rejects malformed, incomplete or unrecognized result envelopes.

Work is proportional to the five bounded response bodies; memory holds at most one capped body and constant-size result metadata. No performance gain is claimed. Validation includes actual serialization into a non-listening Node child, so accidental host-module dependencies are exercised.

## Browser evidence boundary

The five-second strict `scrollWidth <= innerWidth` assertion is unchanged. On its failure, a TreeWalker inspects at most 3,000 elements and records at most 20 overflowing rectangles with tag, bounded test ID and selected layout styles. The record includes viewport/document widths, direction, scan counts and truncation. It collects no text, form values, cookies, storage, network payloads or traces. A viewport screenshot is taken only on failure with a five-second timeout. Capture failure cannot replace the original assertion error.

CI uploads only `overflow-geometry.json` and `overflow-failure.png` under authenticated output folders, retained for three days. It does not upload existing trace archives or general output directories. The scan is O(min(n,3000)) with bounded diagnostic output. Browser capture itself is not yet runtime-verified; hosted evidence is required before changing product layout or closing CI-BROWSER.

## Verification

Code Simplifier and the prose rules were applied before final checks.

| Command                                | Final result                        |
| -------------------------------------- | ----------------------------------- |
| `npm run test:config`                  | PASS, 36/36; zero skipped/cancelled |
| `npm run lint`                         | PASS across existing workspaces     |
| `npm run typecheck`                    | PASS across existing workspaces     |
| Prettier check of the five owned paths | PASS                                |
| `git diff --check`                     | PASS                                |

Tests cover all fixed targets; isolated-network/no-publication model; valid results; non200 and redirect responses; malformed/null/incorrect health; language/form mismatches; missing/incorrect authentication methods; oversized responses; sanitized network failure and timeout; malformed/incomplete result output; and actual child nonzero, timeout, cancellation and output-cap handling. No listener is used. Final command metadata and logs accompany this report.

An initial invocation of nonexistent `npm run check-types` exited 1 before checking code. The corrected final `npm run typecheck` passed. This setup error is preserved in `types.log`.

Only the five authorized candidate paths changed. The original checkout received evidence files only. No application services or Docker/helper listeners were started. Test children finished or were terminated through the command helper, whose promises settle after child close. All tool sessions have ended. No denied operation, security review or CodeQL-detail lookup was attempted. Full application/browser/build gates were not repeated for this bounded helper and diagnostic-only change. Hosted gates still reflect the previous pushed revision; release remains unauthorized until root accepts independent recheck.
