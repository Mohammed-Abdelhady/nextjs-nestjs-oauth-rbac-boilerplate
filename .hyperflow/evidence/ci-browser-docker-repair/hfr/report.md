# HFR001 and HFR002 targeted repair

Status: ready for the same independent reviewer. Neither finding is self-closed. Candidate remains based on `fc19e55e4f2ae1978c19178e1078c76b47acfa2d` with no commit or push. The six-path manifest is frozen at `848666e146c79f11292447b80c0290239fb794fc91a10e5a03725b82812a9a0c`. Four paths differ from the previous reviewed five-path state; the workflow and Docker launch helper are unchanged in this HFR round.

| Finding | Repair                                                                                                                                                                             | Evidence                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| HFR001  | Overflow catch records a capture request and immediately rethrows the original error. Bounded diagnostics run in the first afterEach hook, after the original failure is recorded. | Helper cases and three actual no-browser Playwright failure scenarios pass |
| HFR002  | Restored `headers.get('location') !== null`; empty headers are rejected too.                                                                                                       | Otherwise-valid HTTP200 with an empty Location regression passes           |

## Capture deadline and pending work

[Playwright documents a separate timeout](https://playwright.dev/docs/test-timeouts) shared by afterEach hooks and fixture teardown. [Hooks run in registration order](https://playwright.dev/docs/api/class-test#test-after-each). The installed runner confirms that contract; production code uses only public APIs.

The first afterEach hook consumes a pending request only for the existing overflow failure. It calculates a conservative budget from the public timeout and elapsed hook work. The new helper reserves one second, skips if fewer than 250 ms are available, limits the entire capture to five seconds, and limits cancellation to 250 ms within the reserve. The original assertion has already been recorded before this work begins. Rejected or never-settling capture and cleanup return secondary status instead of throwing a replacement error.

On failure/timeout, an AbortSignal interrupts cancellable file writes and prevents later geometry/write/screenshot stages from starting. Closing only this failed test's owned page interrupts pending browser commands. The cancellation promise is itself raced against a deadline, with rejection handlers retained, so it cannot hold the hook indefinitely. Successful or skipped capture does not close the page. Existing fixture teardown still runs; the browser audit reads its already-collected arrays and attaches them without further page operations. No audit assertion or error exclusion changed.

The original five-second overflow predicate is unchanged. Geometry, bounded traversal/output, screenshot-only capture and the exact CI artifact allowlist remain unchanged in scope. There is no product layout fix or claim that the actual overflowing element is known.

## Generated-project dependency contract

`template.manifest.json` removes maintainer `frontend/e2e/**`. Therefore the new helper lives at `scripts/lib/failure-diagnostics.mjs`, retained beside the root config tests; the proposed frontend helper path was never created.

A rebuilt CLI generated a real default project using `--yes --no-install --no-git`. The generated helper matched source bytes, maintainer e2e was absent, and generated `npm run test:config` passed 43/43. The generated fixture used the retained candidate's dependency directories through symlinks; no new install was claimed. The owned fixture was removed afterward. Exact commands/results are in `generated-retention.json` and accompanying logs.

## Final verification

Code Simplifier and prose guidance were applied before the final checks.

| Command                                   | Result                                 |
| ----------------------------------------- | -------------------------------------- |
| `npm run test:config`                     | PASS 43/43, no skipped/cancelled cases |
| `npm run lint`                            | PASS                                   |
| `npm run typecheck`                       | PASS                                   |
| Six-path Prettier check                   | PASS                                   |
| `git diff --check`                        | PASS                                   |
| CLI build and real generated config tests | PASS; generated 43/43                  |

The capture tests cover completion, insufficient budget, immediate rejection, never-settling work, successful/rejected/never-settling cancellation, original error identity, and prevention of later stages after abort. The no-browser Playwright regression executes three intentionally failing tests (completed/rejected/stalled diagnostics); the enclosing regression passes only if every report has status `failed` and exactly one original assertion error, with no extra timeout or cleanup failure.

Two test-setup corrections are preserved in logs: the installed Playwright CLI is resolved from its exported package metadata directory rather than an unexported subpath; and the synthetic test now expects Playwright's exact `Error:` message prefix, while JSON source context is checked separately. The original-only failure requirement was not weakened. Prior 42/43 results are historical; final 43/43 passed.

No browser, application server, Docker socket or helper listener was opened. The real Playwright regression needs no page/browser fixture. Its worker processes and generated fixtures were cleaned up, and all tool sessions ended. Original repository source is unchanged; only candidate-owned paths and original evidence files were written. Hosted Docker/browser confirmation and the independent HFR recheck remain pending. Security controls, CodeQL limits and Codex-only routing remain unchanged.
