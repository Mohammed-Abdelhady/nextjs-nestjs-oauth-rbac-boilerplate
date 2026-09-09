# T29b implementation evidence

Recorded 2026-09-08 against branch `feat/production-hardening`, base `68cefb6` and the inherited working tree. Implementation is ready for root validation; T29b is not accepted because the complete CLI gates remain blocked. No commit, push, PR, dependency installation or deployment was performed.

| Area                                                  | Status                       | Evidence                                                                                                                      |
| ----------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Existing marker pruning and TOTP/passkey separation   | Implemented, partly verified | Existing source changes preserved; backend tests and frontend build pass. Full generated combinations still need a fresh run. |
| Generated backend feature availability                | Implemented, verified        | All 16 selections of password, magic link, TOTP and passkeys, with each runtime flag both on and off, pass.                   |
| Marker parser edge cases                              | Verified                     | 21 tests cover nested choices, unknown/malformed tokens, mismatched/unclosed blocks, empty input, deep nesting and CRLF.      |
| Workspace lint and typechecking                       | PASS                         | All three workspaces, including frontend RTL utility check.                                                                   |
| Backend unit suite and build                          | PASS                         | 83 suites, 708 tests; `nest build` exits 0.                                                                                   |
| Frontend unit suite and production build              | PASS                         | 13 files, 109 tests; unchanged Next.js production configuration, Turbopack, 43 pages.                                         |
| Focused CLI tests                                     | PASS                         | 5 files, 81 tests.                                                                                                            |
| Complete CLI unit/packed/generation combination gates | BLOCKED                      | Require example-template and generated fixture access that the current security rule prohibits.                               |
| Independent security review                           | BLOCKED                      | Parent reported a review control rejection. No candidate issue was investigated or repaired in this batch.                    |

## Repairs awaiting validation

| ID      | Reproduction and expected behavior                                                                                                                                                                                                                                                                                   | Implementation and regression evidence                                                                                                                                                                                                                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T29B-01 | Select only passkeys or magic link. Previously the shared backend service still enabled password through its default configuration, despite its removal from the selection. Removed methods must stay unavailable even if a runtime flag is true; retained methods must retain their existing flag/default behavior. | Added a marker-pruned availability set checked by `AuthFeaturesService`. Unit tests cover omitted methods and retained flags. A generated-source harness exhausts all 16 method selections and both flag values. The seven full-project combinations now invoke this runtime check too, but that suite is blocked pending permission. |
| T29B-02 | A failed CLI build previously made packed CLI tests skip and allowed an apparently passing suite. A failed build must fail the gate.                                                                                                                                                                                 | Replaced conditional suite skipping with a required `beforeAll` assertion. Lint/typecheck pass; packed execution remains blocked.                                                                                                                                                                                                     |
| T29B-03 | Each source line previously scanned the open-block stack to decide whether it was dropped, making deeply nested input expensive.                                                                                                                                                                                     | A counter tracks dropped frames. The 5,000-level regression passes. Recorded medians are in `marker-performance.json`; this removes the nesting factor from the stack check.                                                                                                                                                          |
| T29B-04 | Empty or whitespace-separated feature tokens were silently left in generated text; stripping a retained marker lost its CRLF terminator.                                                                                                                                                                             | Recognized malformed markers now throw with file/line context; retained CRLF is preserved. Targeted tests pass.                                                                                                                                                                                                                       |

These are implementation findings, not independently closed review findings. No changes were made to passkey challenge consumption or TOTP/recovery consumption.

## Verification commands

Commands used the existing installed dependencies. Framework commands ran in an isolated copy at `/private/var/folders/d1/tk4y3j012j57stv_sy0qpglr0000gn/T/t29b-safe-jke84nuk`, with prohibited files and directories excluded before copying. No existing environment file was opened, copied or loaded. The final copy contains ordinary dependency files instead of external directory symlinks.

| Command                                                                                                                                                   | Exit | Result                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                                                                                                            | 0    | Backend, frontend, CLI; frontend RTL check passes.                                                    |
| `npm run typecheck`                                                                                                                                       | 0    | Backend, frontend and CLI.                                                                            |
| `npm test -w backend -- --runInBand`                                                                                                                      | 0    | 708 tests in 83 suites.                                                                               |
| `npm test -w frontend`                                                                                                                                    | 0    | 109 tests in 13 files.                                                                                |
| `npm run build -w backend`                                                                                                                                | 0    | Production Nest compilation.                                                                          |
| `npm run build -w frontend`                                                                                                                               | 0    | Production Next.js 16.2.12 Turbopack build with unchanged `output: 'standalone'`; 43 pages generated. |
| `../../node_modules/.bin/vitest run test/markers.test.ts test/feature-runtime.test.ts test/manifest.test.ts test/project-name.test.ts test/flags.test.ts` | 0    | From CLI package in the working repository; 81 tests in 5 files.                                      |
| `git diff --check`                                                                                                                                        | 0    | No whitespace errors.                                                                                 |

Before the dependency topology was corrected, the default frontend build exited 1 because Turbopack disallowed an external dependency symlink. A supplementary webpack build compiled, typechecked and rendered all pages, then exited 1 during standalone tracing because of that topology. Neither failed attempt counted as production success. Copying the permitted dependency files fixed the test setup; the original default production command then passed. No application configuration changed.

The source passed a Code Simplifier pass before final verification. The implementation keeps feature policy in the existing shared service, with a small generated constant rather than a second runtime configuration parser. Prose was edited using Unslop and Humanizer.

## Costs and boundary cases

Feature availability is a fixed set of four entries: O(1) lookup and O(1) storage per process. Runtime configuration remains the existing second check. There is no mutable request state or new I/O, retry, concurrency or recovery path.

Marker pruning reads and emits source text, so its lower bound is linear in the input/output size. The dropped-frame counter avoids scanning nesting depth per line. Parsing retains O(input bytes) line/output storage and O(open blocks plus marker IDs) stack storage. Directory enumeration and sorting remain unchanged. No whole-generator performance improvement is claimed.

The timing experiment used seven repeats after warmup and compared the counter implementation with the same parser reconstructed to use its former stack scan. For depth 2 and 1,000 body lines, medians were 0.108 ms before and 0.088 ms after. For depth 5,000 and 5,000 body lines, medians were 61.816 ms before and 3.467 ms after. These are synthetic measurements, not production throughput estimates.

Finite feature selections and nested three-feature selections were exhausted in tests. Malformed markers inside dropped blocks must still fail; retained child blocks cannot escape a dropped parent; unknown, mismatched and unclosed markers fail with location context. The parser and dangling-reference scanner remain line-oriented template checks, not general JavaScript parsers. Full-project compilation is still needed to catch interactions outside the small generated-source harness.

## Paths changed by this specialist

- `backend/src/auth/constants/available-auth-features.ts` (new)
- `backend/src/auth/services/auth-features.service.ts`
- `backend/src/auth/services/auth-features.service.spec.ts` (new)
- `packages/create-nest-next-auth/src/prune/markers.ts` (inherited new file, further edited)
- `packages/create-nest-next-auth/test/markers.test.ts` (inherited new file, further edited)
- `packages/create-nest-next-auth/test/e2e.test.ts`
- `packages/create-nest-next-auth/test/combinations.slow.test.ts` (inherited new file, further edited)
- `packages/create-nest-next-auth/test/feature-runtime.ts` (new)
- `packages/create-nest-next-auth/test/feature-runtime.test.ts` (new)
- `.hyperflow/evidence/t29b/marker-performance.json` (new)
- `.hyperflow/evidence/t29b/implementation.md` (new)
- `.hyperflow/evidence/t29b/remaining-plan.md` (new)

All other inherited T29b changes and unrelated tracker edits remain in place. The root-owned resume checkpoint was not edited.

## Required next boundary

The permission exception is still unanswered. Required tracked examples are `backend/.env.example`, `frontend/.env.example` and `.env.docker.example`; the CLI sync step copies them into its template, and generation/pruning tests create and read example/environment fixtures. No exception for existing real environment or credential files is required or requested by this implementation.

After a narrowly scoped exception is granted, run `npm test -w packages/create-nest-next-auth`, `npm run test:combinations -w packages/create-nest-next-auth`, and the full root build. Inspect every result, including the full-selection source parity check. Keep the independent security-review control blocker separate from these CLI checks. Root must validate all required evidence before T29b acceptance or integration.
