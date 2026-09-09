# Hosted functional diagnosis

Status: NEEDS FIX / NEEDS EVIDENCE. Candidate source remains unchanged after publication.

Revision: `fc19e55e4f2ae1978c19178e1078c76b47acfa2d`. Functional run: [34216745039](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/actions/runs/34216745039).

| Gate                     | Current hosted evidence                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| Quality                  | Passed                                                                      |
| Scaffold combinations    | Passed                                                                      |
| Backend API              | Passed                                                                      |
| Anonymous browsers       | 44/44 passed                                                                |
| Authenticated browsers   | 71/72 passed; one Arabic mobile overflow failure                            |
| Docker                   | All images built; all four services healthy; published-port lookup failed   |
| CodeQL analysis workflow | Passed                                                                      |
| CodeQL PR gate           | Failed; summary metadata reports 31 alerts (30 high, one medium), untriaged |

## CI-BROWSER: repeat failure requires element evidence

`frontend/e2e/authenticated-regressions.spec.ts:84`, “Arabic mobile › supports localized session navigation and keyboard controls without overflow”, fails at lines101–103. After the mobile drawer becomes hidden and finite animations finish, the strict predicate `document.documentElement.scrollWidth <= window.innerWidth` remains false for the full 5,000 ms polling interval. See `browser-hosted.log:729–755` and `integration-counts/counts.json`. The hosted total is 115/116; there are no skipped or flaky cases.

The workflow retains only the count summary. The artifact inventory contains no failure screenshot or error-context file. Thus the offending element and actual overflow distance are not yet known. Previous passing local Chrome checks do not establish why bundled Chromium on the hosted Linux runner fails. No new delay, tolerance, or weakened assertion is justified.

Proposed bounded evidence step, requiring root approval before changes: preserve the exact test and strict assertion; on failure capture a screenshot plus a small geometry JSON containing viewport/document width, direction, and at most 20 out-of-viewport element rectangles with tag/test-ID and relevant layout styles. Include total matching-element count and scan at most a fixed DOM limit, reporting truncation. Do not collect text, input values, cookies, local storage, request bodies, or traces. Retain only these named diagnostics and the failure screenshot in CI for three days. Native reproduction with the workspace Chromium revision can precede hosted capture if that installed runtime is available. A product repair needs an identified element and reproduction; absent that, the next release is diagnostics only for this finding.

The scan is linear in the bounded number of DOM elements, with bounded output and memory. Failure capture must not mask the original assertion error; the existing finite test timeout remains in force.

## CI-DOCKER: isolated networking conflicts with host-port probing

`docker-hosted.log:3398–3404` records startup in 27.2 s, all backend/frontend/mongodb/nginx services running and healthy with exit 0, frontend IPv4 login HTTP200, and completed owned-fixture cleanup. The IPv6 loopback refusal is consistent with the explicit IPv4 listener; it is not the failing health gate.

After startup, `scripts/verify-docker.mjs:303–313` performs only three Docker commands: `compose port backend 5000`, `compose port frontend 3000`, and `compose port nginx 8080`. One exits 1. Subsequent HTTP assertions use Node fetch, so the generic `docker --config exited 1` identifies the port-lookup stage, not an HTTP or JSON-parse failure. The exact service is not retained by the current generic command error.

The fixture attaches every service only to `smoke`, configured `internal:true` at lines144 and189, but expects host publication at lines172–179. Hosted Docker is 28.0.4. Its [version-pinned endpoint implementation](https://github.com/moby/moby/blob/v28.0.4/libnetwork/endpoint.go#L698-L707) explicitly skips external-connectivity programming on internal networks; its [bridge implementation](https://github.com/moby/moby/blob/v28.0.4/libnetwork/drivers/bridge/bridge_linux.go#L1469-L1476) omits gateways for them. The excerpt and upstream blob hashes are saved in `docker-v28-source-excerpt.txt`. These facts support the fixture-contract diagnosis; missing runtime port-binding metadata prevents claiming the exact failed service from the log alone.

Proposed repair, requiring root approval: retain the internal network and run the same bounded HTTP assertions using the installed Node runtime inside the owned backend container, reaching backend/frontend/nginx through service DNS. Remove the incompatible host publication requirement from this isolated smoke fixture; product Compose publication remains unchanged. Preserve actual response shape, login-language/form, enabled-method, timeout, cancellation, output-size and cleanup assertions. Report the named probe and a sanitized status/reason on failure. Do not add a network with outside access, a sidecar image, raw container logs, or environment/config output. Keep pure fixture-model and probe-result regressions for success, invalid response, non200, redirect, timeout and nonzero command outcomes. Root must explicitly accept the smoke-boundary change; it verifies container HTTP reachability, not host publication or production TLS.

No local Docker or previously denied helper-listener operation was retried. Hosted confirmation is still required after any accepted repair.

## Release and stopped boundary

The normal push completed with genuine hooks. PR72 remains open and draft at the revision above, with a current body and verified revision-pinned report links. All hosted jobs have completed. Candidate worktree is clean; original 847 nonsecret files retain their prior fingerprint. No application processes were started during this diagnosis, and no tool sessions remain running. All CodeQL details and the paused security review remain untouched.
