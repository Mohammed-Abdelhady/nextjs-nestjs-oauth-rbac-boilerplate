# CI-COMB-01 targeted repair

Status: **implemented and locally verified; independent recheck pending**. The candidate is frozen without commits or push. Root accepted FR001–FR003 and GR001–GR007 after the prior independent recheck; this follow-up changes only the two authorized combination-runner test files.

New full candidate fingerprint: `bac50560111ad528ae0d91d2209bb4e281911ab106e9803e2f7cff7bcddc645d`. Git HEAD remains `3e84f52312196c03aaefc109ceca05c71bebc712`. The candidate still contains the same 25 changed paths. [repair.patch](repair.patch) is the exact two-file delta against the previously reviewed hashes; [after-manifest.json](after-manifest.json) captures the new full manifest. The previous manifest is preserved alongside it.

## Change and regression

`packages/create-nest-next-auth/test/combination-helpers.ts` now retains failed-command stdout and stderr alongside the failure reason. Node already appends stderr to its error message, so the formatter removes that trailing copy before joining the reason and streams. Empty sections are omitted; trailing whitespace is trimmed. Successful output, the existing 8 MiB per-stream buffer limit, timeout, cancellation and nonzero handling are unchanged. Unknown non-Error failures retain the previous string fallback.

`packages/create-nest-next-auth/test/combination-command.test.ts` adds a stdout-only compiler-style failure. The child command contains a hex-encoded diagnostic, so an echoed command cannot satisfy the assertion. The test requires the decoded diagnostic as one exact output line and retains the failure reason assertion. The existing stderr case now also requires exactly one diagnostic line. Existing responsiveness, timeout and cancellation cases remain intact and pass.

Formatting requires linear work and additional memory proportional to the already bounded captured text. No compiler performance improvement is claimed. Code Simplifier guidance was applied before final checks; one comment explains Node’s nonobvious stderr duplication behavior.

## Verification

All final commands used the retained official Node22.18.0/npm10.9.3 environment and exited 0. [gates-final.json](gates-final.json) records the commands and exits.

| Command                                              | Result                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| Prettier on the two assigned files                   | PASS                                                          |
| `npm test -w create-nest-next-auth`                  | 107/107 tests, eight files                                    |
| `npm run test:combinations -w create-nest-next-auth` | 9/9, including actual generated API boot; no worker RPC error |
| `npm run lint -w create-nest-next-auth`              | PASS                                                          |
| `npm run typecheck -w create-nest-next-auth`         | PASS                                                          |
| `git diff --check`                                   | PASS                                                          |

An initial write escaped a newline incorrectly and the formatter rejected the syntax before tests ran. That local editing error was corrected; the failed formatter log and final passing log are both retained. No application/API/browser/build gates were repeated because this delta changes test-helper failure reporting only. Their previous passing evidence remains attached to the earlier capture.

The owned runner exited normally. No service was started beyond the combination suite’s existing disposable fixture; no application, source configuration, lockfile or original checkout product file changed. No denied Docker/helper-listener or blocked security investigation was attempted. Hosted CI confirmation remains pending, including browser and Docker failures. This report does not independently close CI-COMB-01.
