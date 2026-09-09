# T30 operational targeted repair

Source writes have stopped. T30-OP-001 has a one-line repair and a passing before/after regression, ready for root validation and independent recheck. This report does not close the finding. Runtime readiness remains blocked.

| Item                                                                 | Result                              | Evidence                                                       |
| -------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| T30-OP-001                                                           | Repaired, awaiting review           | `repair.diff`, `filtered-context-results.json`                 |
| Final lightweight run                                                | 20 PASS, 13 BLOCKED                 | `lightweight-results.json`, `lightweight.log`                  |
| Static checks                                                        | 10 PASS                             | `static-checks.json`                                           |
| Successful helper HTTP progression                                   | BLOCKED by loopback listener denial | `listen-denied.log`; authored cases in `http-probe-checks.mjs` |
| Malformed published ports                                            | Five cases PASS                     | `http-probe-results.json`                                      |
| Residual-resource detection after failed assertions                  | Three cases PASS                    | `http-probe-results.json`                                      |
| Actual image builds and Docker smoke                                 | Unverified                          | No daemon command or retry allowed or attempted                |
| Production TLS, supported Node 22 install and packed/generated gates | Unverified                          | Existing runtime limits remain                                 |
| Rejected security review and candidates                              | PAUSED                              | Untouched and uninvestigated                                   |

## Source boundary

The base revision remains `68cefb61f450b94c195a8d6cf325ac5e26c15349`. All eight operational paths matched the independent review's initial capture hash `4e305e34367d0ee3c5aa938ed3a8cdcdbfa3b9dc2770c2006feae973f46df711` before repair. Their final ordered capture hash is `dba214cd37aff1a42453d05497f91c73ea04be2ef7c0e92db4c84183be6e4ac2`.

`capture-before.json` and `capture-after.json` enumerate exact file hashes. Only `.dockerignore` changed among the eight operational files. `scripts/verify-docker.mjs` is byte-for-byte unchanged. No helper source defect was established by the executed cases.

Changed existing paths:

- `.dockerignore`
- `.hyperflow/evidence/t30-operational/lightweight-checks.mjs`

New regression sources:

- `.hyperflow/evidence/t30-operational-repair/filtered-context-check.mjs`
- `.hyperflow/evidence/t30-operational-repair/http-probe-checks.mjs`

All other writes are evidence under `.hyperflow/evidence/t30-operational-repair/`. The existing lightweight runner now calls the two regressions and writes results into this repair directory. The previous results remain intact. Code Simplifier guidance was applied before final verification. Formatting changes in the existing evidence runner account for most of its diff.

The eight-file inventory also includes `.github/workflows/ci.yml`, `nginx/.dockerignore`, `nginx/nginx.conf`, `.gitignore`, `packages/create-nest-next-auth/scripts/sync-template.mjs` and `packages/create-nest-next-auth/test/e2e.test.ts`. Their hashes did not change. Frontend, backend, manifests, root lockfile, CI, CLI source and root checkpoint received no writes from this assignment. Native E retains its concurrent ownership.

## OP001 rationale and regression

The repair removes `**/e2e` from `.dockerignore`. The retained Playwright config imports a fixture under that directory, and that fixture imports another e2e utility. Keeping the source directory preserves this dependency chain and the existing frontend TypeScript checks. Exclusions for output, reports, storage state, dependencies and prohibited names remain in place. No frontend build check was weakened.

The regression filters the actual current frontend filenames before reading content. It applies the helper's export exclusions and the Docker ignore rules, omits symlinks, and builds an in-memory compiler host from retained source files. Its matcher supports the current exclusion-only glob syntax and rejects unsupported future syntax. It models filtering without invoking Docker. Dependency resolution uses installed tooling; other live workspace source cannot satisfy missing context modules.

The same captured frontend inputs are checked twice, first with the saved pre-repair rules, then with the repaired rules. TypeScript resolves relative and `@/` imports across retained frontend TypeScript/JavaScript source. The checker also requests actual semantic diagnostics for the affected Playwright config, which the existing tsconfig includes.

| Contract                                   | Before                              | After                       |
| ------------------------------------------ | ----------------------------------- | --------------------------- |
| Retained frontend files                    | 369                                 | 384                         |
| Local source imports checked               | 1,003                               | 1,015                       |
| Unresolved source imports                  | One, `./e2e/frontend-only/fixtures` | Zero                        |
| Affected Playwright config diagnostics     | TS2307 for the missing fixture      | Zero                        |
| Selected input drift during final analysis | Same captured inputs used           | Zero changed selected paths |

The regression separately records `next-env.d.ts` referencing `.next/types/routes.d.ts`. That file is generated during the build and is outside the source-input assertion. Styles and image imports are also outside this TypeScript module-resolution assertion. This is neither a full frontend typecheck nor a production image build. `filtered-context-results.json` records the exact 384-file capture and timestamps. It does not establish a stationary revision of the concurrently edited repository as a whole.

## Helper cases and expected outcomes

The existing eleven lightweight checks ran again and passed. They cover workflow structure, ignore/export classification, the existing CLI exclusion callback, model construction, subprocess bounds and four fake-Docker failure/cleanup cases. The CLI callback still runs without the packed suite's build hook; it is not the full CLI suite.

The new executed helper cases use only a synthetic `docker` executable in the child PATH. No real Docker binary can be selected by those cases. The executable returns synthetic model, image, port and resource-list output. Each child environment also checks that the sentinel provider variable was not inherited.

Five malformed-port cases exercise successful fake startup and port discovery. Empty output, non-loopback address, nonnumeric port and multiple address lines must fail the loopback assertion. Port 65536 reaches all three discovery calls and fails URL parsing before network connection. Every case exits 1, runs scoped teardown, verifies empty resource lists and removes its owned helper fixture. There are no HTTP requests in these cases.

Three residual-resource cases pair malformed-port failure with successful fake teardown. The fake resource inventory then reports a remaining container, network or volume. Each case must exit 1, stop cleanup verification at that resource and retain its synthetic recovery configuration. The test verifies retention, then removes its owned directory. This exercises residual detection after an assertion failure, not after successful HTTP probes and not against real resources.

Thirteen authored cases require local HTTP endpoints: successful five-request progression, 503, redirect, malformed JSON, unexpected health field, oversized response, wrong Arabic document language, enabled provider, SIGINT during a request, SIGTERM during a request, and one post-success residual case for each resource type. Their successful path expects backend health, nginx health, English login, Arabic login and auth methods in that order. Cancellation expects a nonzero signal-specific exit and scoped cleanup. These cases have not run through requests.

The initial listener attempt failed immediately with `listen EPERM: operation not permitted 127.0.0.1`. The test's finally blocks ran; no listening socket or helper child was created by that case. The denied listener was not retried or escalated. Final runs use explicit `--no-listen`, report all thirteen cases BLOCKED, and execute only cases requiring no socket. No fake success is reported as realDocker evidence.

## Commands and attempts

All execution used installed Node `v26.8.1`; the compiler reports TypeScript `5.9.3`. No package install, heavy build, browser, application service, database, mail endpoint, provider, Node download or Docker daemon command ran.

| Command or operation                                                                                    | Exit/result                                                                              |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Initial eight-file SHA-256 reconciliation and owned before copies                                       | 0                                                                                        |
| Initial `node .hyperflow/evidence/t30-operational-repair/filtered-context-check.mjs`                    | 1, test setup used compiler option conversion without tsconfig-relative alias resolution |
| Corrected standalone filtered-context command                                                           | 0, before TS2307 and after zero diagnostics/import gaps                                  |
| Initial `env -i PATH="$PATH" node .hyperflow/evidence/t30-operational/lightweight-checks.mjs`           | 1, eight checks passed before first listener failed EPERM                                |
| First `env -i PATH="$PATH" node .hyperflow/evidence/t30-operational/lightweight-checks.mjs --no-listen` | 0, twenty checks passed and thirteen listener cases reported blocked                     |
| Final same `--no-listen` command after evidence/assertion refinements                                   | 0, 20 PASS and 13 BLOCKED recorded together in results JSON                              |
| `node --check scripts/verify-docker.mjs`                                                                | 0                                                                                        |
| `node --check .hyperflow/evidence/t30-operational/lightweight-checks.mjs`                               | 0                                                                                        |
| `node --check .hyperflow/evidence/t30-operational-repair/filtered-context-check.mjs`                    | 0                                                                                        |
| `node --check .hyperflow/evidence/t30-operational-repair/http-probe-checks.mjs`                         | 0                                                                                        |
| Installed Prettier API formatting, then checks on those four scripts                                    | 0; four final checks pass                                                                |
| `git diff --check -- .dockerignore scripts/verify-docker.mjs`                                           | 0; Git reported its temporary-directory fallback warning                                 |
| `env -i PATH="$PATH" node scripts/verify-docker.mjs --check-checkout`                                   | 0; filename inventory guard                                                              |
| Final capture, JSON count checks and exact owned PID/filesystem checks                                  | 0                                                                                        |

The initial alias-resolution failure was in the new regression setup. Using the existing tsconfig parser corrected it. No application or helper correction followed from that failure. The loopback denial is an execution limit, not a product finding. Repeated runs followed changes to the tests and their evidence fields; counts above are final-run counts, not accumulated passes.

## Cleanup and costs

`cleanup.json` records the final owned parent `/tmp/t30-light-hOf2TO` as absent. All eight newly executed helper PIDs return ESRCH both after their test and at final capture. The existing four fake scenarios await child close events. Retained synthetic recovery directories were inspected only for the expected file's existence, then removed by their owning test. The temporary directory inventory contains no `t30-light-` parents. Final execution started zero listeners and zero Docker resources. No native ports 3107, 5107 or 5108 were used.

The context regression stores source buffers once and shares them between before/after maps. Filtering costs O(F × P × D) pattern checks for F candidate paths, P ignore rules and path depth D, plus source-byte reads and the final hash pass. It retains O(source bytes + F) snapshot data in addition to TypeScript's dependency graph. Module-resolution caching avoids repeating equivalent resolution work; compiler work depends on the installed declarations and reachable modules. No benchmark or speedup is claimed.

The helper architecture is unchanged. Its service count and probe sequence remain fixed, with existing subprocess, response and cleanup bounds. Added scenarios run sequentially with a 15-second child limit and finally-based cleanup. No additional runtime abstraction or dependency was needed.

## Handoff and remaining limits

This consumes the authorized single targeted repair round. Root should validate the current capture and return it for independent OP001 recheck. The finding remains open until root validates that evidence. The listener-dependent cases are implemented but unverified; their success cannot be inferred from syntax checks or the no-listener cases. Running them requires an execution context that permits local synthetic HTTP listeners.

Production image builds still require an authorized Docker runtime. The prior explicit Docker socket denial remains binding, and no retry occurred. Supported Node 22, fresh installation and packed/generated-project gates remain outside this repair's evidence. Production TLS and certbot remain unverified. Real environment and credential files were neither read nor written. No certificate material was accessed. The paused security review and candidates remain untouched.

No fallback, delegation, integration, commit, push, PR, publication, deployment or external message occurred. This was the existing Astra specialist repair assignment; no alternative model or provider route was attempted. Root retains coordination and acceptance authority. The next action is independent source/evidence recheck, with source writes stopped at `capture-after.json`.
