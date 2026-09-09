# T29b dependency reconciliation

The Commander failure is a snapshot-copy defect. The unchanged CLI passes its complete package and generated-combination suites when its workspace-local dependencies are retained. The original root production build remains blocked by frontend Google Fonts fetch failures. This evidence is ready for root validation; it does not accept T29b or close review findings.

| Required gate                                                 | Exit | Result                                                                                                                                                  | Log                        |
| ------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `npm test -w packages/create-nest-next-auth`                  | 0    | 96 tests in seven files pass, including five packed-package tests and 16 compiled feature selections. Zero skips.                                       | `03-cli-package-suite.log` |
| `npm run test:combinations -w packages/create-nest-next-auth` | 0    | Nine tests pass. Seven generated selections, 14 backend/frontend typechecks, compiled availability checks and full-selection source parity. Zero skips. | `04-combinations.log`      |
| Original `npm run build`                                      | 1    | Backend compilation and CLI bundling complete; frontend fails fetching Geist and Geist Mono.                                                            | `05-root-build.log`        |
| `npm ls commander --all --json`                               | 0    | Workspace dependency tree resolves the expected Commander versions.                                                                                     | `06-commander-tree.log`    |

## Causal evidence

T29B-DEP-01 is a reproduced verification-setup finding, pending root validation. The earlier worker excluded `node_modules/` at every depth, then restored only root `node_modules`. That omitted `packages/create-nest-next-auth/node_modules/commander`. The exact earlier commands are preserved in `prior-copy-commands.txt`.

| Importer or dependency owner                    | Resolved Commander     | `.argument`                 |
| ----------------------------------------------- | ---------------------- | --------------------------- |
| CLI package manifest and `src/flags/options.ts` | Workspace-local 15.0.0 | Function                    |
| Root, backend and frontend package manifests    | Root 4.1.1             | Undefined                   |
| `@nestjs/cli` 11.0.24                           | Root 4.1.1             | Expected transitive version |
| `lint-staged`                                   | Local 13.1.0           | Not used by the scaffolder  |
| `migrate-mongo`                                 | Local 9.5.0            | Not used by the scaffolder  |
| `terser`                                        | Local 2.20.3           | Not used by the scaffolder  |

The CLI manifest declares `commander: ^15.0.0`; the lockfile records 15.0.0 beneath that workspace and 4.1.1 at root. Both installed locations match. Importer-specific observations are in `source-resolution.log`, `snapshot-resolution.log`, and `corrected-snapshot-resolution.log`. The earlier report's source-resolution claim did not distinguish importers.

Temporarily omitting only the snapshot CLI dependency directory reproduces five failures and three passes with `npm test -w packages/create-nest-next-auth -- test/flags.test.ts`, exit 1. All five failures point to `.argument` at `src/flags/options.ts:24`. See `00-omission-reproduction.log` and `omitted-workspace-resolution.log`. Restoring the directory makes all eight flag tests pass in the complete 96-test run. Successful packed CLI generation also establishes that the bundle works independently of importer-local runtime dependencies.

No application source, dependency declaration, lockfile, frontend configuration or assertions were changed. No package installation or version upgrade was needed. Existing declarations and CLI bundling configuration remain intact. The bundler emits an existing `noExternal` deprecation warning; it does not prevent the CLI build.

## Snapshot and verification setup

Base revision is `68cefb61f450b94c195a8d6cf325ac5e26c15349` plus inherited uncommitted work. Capture completed at `2026-09-08T07:34:42.903028+00:00`. The permitted 832-file source inventory was identical before copying, in the copy, and after dependency copying.

Source fingerprint is `cd385c9fec47083127c8c139708b17f46e0944490a145938dce63936ea3e9e69`. `snapshot.json` records the exact hash algorithm and every file hash. The owned container is `/private/tmp/t29b-dependency-reconcile-ispf1d8i`; final verification ran from its `checkout` directory. Runtime home, npm cache and temp fixtures were siblings of the checkout. `final-boundary.json` confirms none of the captured snapshot source files changed during verification.

The snapshot preserved root, backend, frontend and CLI workspace dependency directories. All 90 copied symlinks remained inside the owned snapshot. The CLI binary link initially lacked its generated target and resolved after build. The initial capture validator rejected that expected missing build output, then continued after a narrow allowance for that one link. No dependency files were installed or modified in the source repository.

Only `.env.docker.example`, `backend/.env.example` and `frontend/.env.example` entered the snapshot. The build's template contains copies of those approved examples. Final filename inspection found those six example paths and no credential suffix files. No real environment file was read, copied or loaded. Gate processes used a clean environment, isolated HOME/cache/TMPDIR, Node v26.8.1, and no inherited application configuration or `NODE_OPTIONS`.

Two setup attempts precede the final passing suite. `01-cli-package-suite.log` records 80 passes and 16 failures because placing TMPDIR inside the ESM repository made minimal runtime fixtures inherit its package scope. A temporary neutral package boundary resolved that inheritance, but `02-cli-package-suite.log` records 95 passes and one failure when repository enumeration raced fixture cleanup under the same tree. Moving the unchanged checkout and runtime into sibling directories resolved both setup problems. The temporary package-boundary file was removed. All failed logs remain; none count as successful gates.

The controlled omission test also created a fresh `.vite` cache at the missing CLI dependency location. The first restore rename failed because that directory existed. Only the known test-created cache was moved aside, then the original dependency directory was restored. The final dependency tree and passing suite verify recovery.

## Generated coverage

`generated-coverage.json` records these seven selections:

- Email/password alone.
- Magic link alone.
- Email/password and Google.
- Email/password and TOTP.
- Passkeys alone.
- Email/password, TOTP, passkeys and all 12 OAuth providers.
- All 17 available manifest entries, including hidden OAuth core.

Every selection compiles backend and frontend TypeScript and checks generated method availability with runtime flags enabled and disabled. The separate feature-runtime suite exhausts all 16 subsets of the four credential/second-factor methods, with four methods and two flag states per subset. Its assertions check enabled behavior and disabled 404 behavior. The full generated selection matches `backend/src`, `backend/test` and `frontend/src` after marker removal. Packed tests verify defaults, pruned providers/configuration, restored tarball filenames, project naming and marker removal.

These generated checks are typechecks and focused compiled behavior checks. Real production compilation was separately attempted through the original root command. Backend output and CLI bundle hashes are recorded in `final-boundary.json`; frontend production success is not claimed.

## Remaining limits and ownership

T29B-DEP-02 is an unresolved build blocker, pending root triage. The frontend production command reports failures requesting the Geist and Geist Mono stylesheets from `fonts.googleapis.com`. The log does not establish a lower-level DNS, TLS or proxy cause. No fallback compiler, mocked font response, local font substitution, cache-based acceptance or frontend repair was attempted. A further frontend/build-environment assignment is needed for a successful root gate.

Later source changes appeared in eight backend test/configuration paths after capture. `final-boundary.json` lists them. This evidence applies only to the captured fingerprint, not the concurrent frontend worker's later revision or later backend fixture work. No backend/frontend unit suites were repeated. Security-review candidates, release actions and the root-owned checkpoint remain untouched.

The dependency architecture and application algorithms are unchanged. Correct copying must preserve importer-local dependency boundaries. Snapshotting costs O(total copied bytes) I/O and disk, with O(source bytes) hashing and O(file count) hash metadata. No application speedup is claimed. Tests cover the confirmed missing-local-dependency case, invalid flag/name and marker cases, finite feature selections, package independence and generated parity. They do not prove every possible feature combination or external integration.

Only this evidence directory and the named disposable container were written by this specialist. Evidence helpers received a Code Simplifier pass; Python syntax was checked. Unslop and Humanizer were applied to the report. This is the first Astra attempt for this dependency batch. No fallback, source repair, commit, push, publication, deployment or contact occurred. Cleanup evidence is in `cleanup.json`.

Cleanup completed at `2026-09-08T07:42:15.776856+00:00`. The entire owned container, build outputs, synthetic fixtures and caches were removed. All gate commands returned, and the final npm process was verified absent. Process enumeration was unavailable because `ps` was rejected with `Operation not permitted`; independent confirmation of every descendant process is therefore not claimed. No server was launched by this assignment. Available disk after cleanup was 14,499,840,000 bytes.
