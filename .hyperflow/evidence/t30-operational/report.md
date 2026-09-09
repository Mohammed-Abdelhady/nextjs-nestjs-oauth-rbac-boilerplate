# T30 operational source boundary

Source writes are stopped. This batch is ready for root evidence validation and a later runtime assignment. It is not accepted or runtime verified.

| Item                                                     | Status                                         | Evidence                                       |
| -------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Assigned operational source                              | Implemented                                    | Eight paths in `capture.json`                  |
| Lightweight verification                                 | PASS                                           | Eleven checks in `lightweight-results.json`    |
| Node 22 install, full package and combination gates      | Pending window                                 | Commands in `gates.md`                         |
| Backend and sequential browser integration               | Pending native fixture stabilization           | CI commands are implemented, not executed here |
| Real Docker builds, readiness and direct HTTP assertions | Pending window                                 | `scripts/verify-docker.mjs`                    |
| Production TLS and certbot                               | Unverified, certificate access remains blocked | No certificate file created, read or mounted   |
| Rejected security review and candidates                  | PAUSED                                         | Not investigated, reproduced or reassigned     |
| Release                                                  | Not assigned                                   | No commit, push, PR, publication or deployment |

The source capture hash is `4e305e34367d0ee3c5aa938ed3a8cdcdbfa3b9dc2770c2006feae973f46df711`. It hashes the ordered path/SHA-256 objects in `capture.json`. The base revision is `68cefb61f450b94c195a8d6cf325ac5e26c15349`. This is an eight-file capture, not a stationary capture of the concurrently edited backend/frontend tree.

## Changed paths

- `.github/workflows/ci.yml`
- `.dockerignore`
- `nginx/.dockerignore`, new
- `nginx/nginx.conf`
- `.gitignore`
- `scripts/verify-docker.mjs`, new
- `packages/create-nest-next-auth/scripts/sync-template.mjs`
- `packages/create-nest-next-auth/test/e2e.test.ts`

The inherited combinations job remains in CI. Its install/run commands now use a clean environment. The CLI spec retains inherited T29b changes; this batch adds only imports needed by one exclusion regression and that regression. No backend/frontend source, fixture, package manifest, root lockfile or root checkpoint was edited.

## Decisions

CI rejects prohibited tracked filenames before dependency or application tools run. Only the three approved tracked environment example names pass that guard. Install, build, test and browser commands use `env -i`, an isolated tool home and explicit synthetic values. The integration job installs the workspace-resolved Playwright Chromium revision, uses zero-retry existing configurations, and runs anonymous then authenticated tests on their shared port. It uploads only selected count diagnostics for three days. Raw reports, traces, storage state and mail are not uploaded. The combinations and integration jobs have repository conditions so generated selections do not invoke maintainer-only contracts.

Docker CI builds from a filtered source export and loads three explicitly tagged production images. It pulls the Mongo image separately. The helper never builds or pulls implicitly. It derives service healthchecks, dependencies and resource limits from the existing production Compose model with env-file resolution disabled. It constructs four synthetic services, discarding inherited environment, fixed container names, builds and mounts. Mongo uses private owned storage and no host port. An internal network blocks service egress. Docker allocates loopback probe ports. The helper supplies an empty Docker config and clean environment; an optional explicit local Unix socket supports Docker Desktop without reading its user configuration.

The HTTP health route is exact and returns the minimal JSON liveness body before the catch-all HTTPS redirect. The TLS server's existing backend health proxy is unchanged. The smoke helper extracts that new location into a disposable HTTP-only nginx config. This checks the corrected route in the built nginx image but cannot establish production TLS or certbot readiness. Frontend assertions inspect English/Arabic HTTP login documents; the helper does not exercise client JavaScript against the dynamically published API port.

Startup has a 240-second Compose readiness budget and a 260-second subprocess bound. Other commands, requests, diagnostics and teardown are also bounded. Subprocess output and HTTP bodies are limited to 1 MiB. Diagnostics retain only service/state/health/exit-code fields. Failure and cancellation preserve a nonzero exit status. Cleanup targets the unique project, removes its volume and verifies no project-labelled containers, networks or volumes remain. If cleanup fails, the helper reports the project and retains the synthetic configuration for recovery. It does not prune global resources.

Exports and template copies reject names before content access and skip symlinks. Templates retain only the three approved example paths, and only as files. Artifact exclusions preserve test source such as `frontend/e2e/fixtures`. Certificate and credential classification tests use filename strings, without creating or opening those files. Temporary synthetic environment sentinels fall within the approved fixture exception.

Source traversal costs O(visited entries + copied bytes) time and I/O. Directory-entry arrays are retained along the traversal depth; the worst case uses O(visited entries) metadata memory. Fixed-size command/response buffers bound runtime output memory. The model has four services and constant-size probes. No speedup or benchmark result is claimed. Fresh dependency installation and image builds remain the main expected disk/network costs.

Code Simplifier guidance was applied to the changed code before final checks. Unslop and Humanizer were applied together to this report and handoff prose.

## Verification

| Command or check                                                                            | Exit/result                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `node --check scripts/verify-docker.mjs`                                                    | 0                                          |
| `node --check packages/create-nest-next-auth/scripts/sync-template.mjs`                     | 0                                          |
| Installed Prettier API format/check on the two scripts, CLI spec and CI YAML                | 0                                          |
| `env -i PATH="$PATH" node scripts/verify-docker.mjs --check-checkout`                       | 0; filename inventory only                 |
| `env -i PATH="$PATH" node .hyperflow/evidence/t30-operational/lightweight-checks.mjs`       | 0; 11 checks pass                          |
| Scoped `git diff --check` on owned tracked source                                           | 0                                          |
| `git check-ignore` for output, nested test-results, playwright-report and `.auth` sentinels | 0; all four ignored                        |
| Source capture JSON and hash                                                                | Written and parsed successfully            |
| Global process inventory via `ps`                                                           | Denied by sandbox; no escalation attempted |

The lightweight runner parses CI, checks guard/command ordering, image-load flags and sequential browser jobs, checks ignore rules and route extraction, exercises export filtering and symlink omission, then executes the actual new CLI regression callback against a disposable mini-repository. It deliberately does not run the packed suite's global build hook. That full suite remains required.

It also checks model sanitization and missing healthchecks, real subprocess timeout/output-limit/missing-executable behavior, and four fake-Docker paths: missing image, startup failure, SIGTERM cancellation, and cleanup failure. These prove helper control flow with a fake executable, not Docker daemon behavior. The cleanup-failure fixture was retained by the helper and removed by the owning lightweight test after its recovery assertions. A readiness failure from an unhealthy service or port publication failure uses the same startup-failure cleanup path, but actual Docker behavior still needs verification.

Local lightweight execution used Node `v26.8.1`. The requested Node 22 runtime was not available at the probed Homebrew path. Earlier disposable runner attempts failed on the runner's `default` namespace argument and then exposed the macOS realpath entry-point issue. Both were corrected; subsequent complete runs pass. Two initial tool-discovery one-liners had syntax errors and were replaced by a successful heredoc. These are setup attempts, not product gate results.

Every lightweight child was awaited through exit and every owned temporary fixture was removed. No Docker daemon operation, package install, full combination run, browser or occupied application port was started. OS-wide process enumeration was unavailable, so cleanup evidence is limited to owned child exit events and owned filesystem checks. No model/provider failure occurred; route remains Codex with no Antigravity attempt and no exhausted supporting routes.

## Remaining risks and next action

Root should validate this source boundary, reconcile the native fixture revision, then assign the heavy commands in `gates.md`. Do not claim readiness from these static and fake-process checks. Actual Docker plugin discovery with an empty user config, Compose-generated service probes, production image startup, browser dependencies, final CLI package behavior and generated workflows remain unverified here. Hosted CI needs the separately authorized integration assignment. The rejected review control remains unchanged.
