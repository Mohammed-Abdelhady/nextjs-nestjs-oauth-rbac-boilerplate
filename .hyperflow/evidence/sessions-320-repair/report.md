# Sessions at 320 px

Status: **FROZEN FOR INDEPENDENT RECHECK**. Candidate base remains `954b99a319d171d8dd488372fda6f4f530440dce`. No commit or push.

| Finding             | Repair and observed result                                                                                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SESSIONS-320-LAYOUT | The existing actions row now permits natural wrapping. Both full labels and button styles remain. English and Arabic 320 px tests pass strict document overflow and individual button bounds/content checks.                                              |
| SESSIONS-320-FOCUS  | The existing button is now the controlled dialog's `AlertDialogTrigger asChild`. Cancel and Escape return focus to that button; successful confirmation retains the current session and removes the other session. The trigger then disappears as before. |

The first finding follows the accepted five-path capture: the sessions source was unchanged from the base, but there was no matched base-runtime capture. That capture measured a 288 px available area and a nonwrapping actions row of 336.64 px in English and 355.39 px in Arabic. Its document widths were 353 and 371 at viewport 320. This report does not characterize that as a matched runtime comparison against the base revision.

Only three approved paths changed in this batch:

- `frontend/src/app/[locale]/(dashboard)/sessions/page.tsx`: add `flex-wrap` to the actions group.
- `frontend/src/modules/sessions/components/RevokeAllSessionsButton.tsx`: connect the existing button through the exported Trigger inside the existing controlled dialog, retaining mutation, loading, disabled, translation and error behavior.
- `frontend/e2e/authenticated-regressions.spec.ts`: two localized 320 px journeys covering the complete action lifecycle.

The four other paths from the independently reviewed five-path repair remain byte-identical (`accepted-baseline-parity.json`). Original checkout source was not edited. The delta manifest is `three-path-manifest.json`, fingerprint `32940748ef11983edd7ea5f3110e6ac7792a6ba4611a3566a2cd927a42c09d3f`. The full pending seven-path aggregate is `aggregate-seven-path-manifest.json`, fingerprint `b16a0fc5a6f122c475ba761629d0aa4fa475255889305eb40a92774d73b3d620`. Corresponding patches are retained alongside them.

## Verification

All commands used retained Node 22.18.0, the clean allowlisted environment and the existing disposable backend/database fixture. No real environment files, external provider or delivering mail service were used.

| Command                                                         | Final result                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `npm run build`                                                 | PASS, all workspaces; exit 0                                        |
| `npm run lint`                                                  | PASS; exit 0                                                        |
| `npm run typecheck`                                             | PASS; exit 0                                                        |
| `npm run test --workspace frontend`                             | 123/123 PASS; exit 0                                                |
| `npm run test:e2e --workspace frontend -- --reporter=line,json` | 78/78 PASS in 112.49 seconds; zero failed, skipped or flaky; exit 0 |
| Prettier check on three owned paths                             | PASS; exit 0                                                        |
| `git diff --check`                                              | PASS; exit 0                                                        |

The new journeys assert two distinct session identities, visible enabled unobstructed buttons, full button content within bounds, and document width no greater than 320. They verify Refresh→Tab→revoke and reverse keyboard order; keyboard and touch refresh both return 200 and preserve identities. Keyboard cancel and Escape preserve identities and return focus to the existing trigger. Touch confirmation returns 200, leaves the original current-session identity, removes the other session, and removes the revoke-all button. A further touch refresh preserves the remaining identity. No focus assertion targets the removed trigger after success.

The same full run retains passing en/ar 385/390/1280 controls, theme, skip-focus and strict geometry cases, along with the existing session, sidebar, lifecycle, provider-fixture and permission journeys. Runtime error audits remained enabled. Unchanged anonymous 44/44 and config 65/65 results belong to the prior accepted capture and were not rerun for these session-only changes. No backend or generator source changed; their previously accepted suites were not repeated.

Final screenshots from this successful run were inspected directly:

- `screenshots/en-two-sessions-320.png` and `screenshots/ar-two-sessions-320.png`: full action labels wrap into separate rows; header controls and both session cards remain within the viewport.
- `screenshots/en-one-session-320.png` and `screenshots/ar-one-session-320.png`: Refresh and the current-session card remain, revoke-all is absent, and the localized success toast is visible.

The passing assertions provide final geometry bounds; this run did not emit a separate numeric geometry JSON. Wider numeric geometry remains in the prior accepted capture.

## Initial failure and focused repair

The initial run passed 76/78. Both new cases reached and passed layout, keyboard order, refresh identity and cancel state checks, then failed the unchanged focus-return assertion. The opener was outside the controlled AlertDialog and used manual `onClick`, leaving no Trigger reference for close-focus restoration. Root confirmed that finding and authorized the third path. `initial-browser.log`, `initial-browser-results.json` and `initial-browser-gate.json` preserve that failure. The final run includes both cancel and Escape restoration and passes all 78 cases.

The existing UI wrapper exports Radix Trigger directly. Public Radix documentation retrieved through Context7 confirms controlled open/onOpenChange, `asChild` composition and return-to-trigger close focus. The installed Button forwards its ref and props. Documentation output is retained in `radix-library.log` and `radix-docs.log`. No private APIs, custom focus timer or new dependency was introduced.

## Quality and stopped boundary

Code Simplifier guidance applied before final verification; the single dialog root replaces the unnecessary outer fragment and manual opener callback. No new state, listeners or network operations were added. Wrapping uses the existing layout engine, and the trigger uses the established accessible primitive. Production session-list cost remains linear in the number of displayed sessions; this change adds constant control overhead. The fixture has two sessions; identity comparisons inspect and sort that bounded list. No measured performance improvement or exhaustive state-space claim is made.

The tests cover narrow and wider widths, both directions, two-session and one-session state, cancel/Escape recovery, and keyboard/touch activation. Existing loading/error behavior is preserved; this batch does not add an exhaustive concurrency or failed-mutation matrix. No unrelated dialog or security/business policy changed.

`cleanup.json` records closed command sessions and free ports 3107, 5107 and 5108. The successful fixture teardown awaited its owned backend exit; the frontend process was owned by Playwright. Candidate and Node 22 runtime remain available for integration. No service is intentionally left running. Security-review candidates, alert details and previously denied Docker/helper-listener operations remain outside this work. `fallback_scope=codex-only` persists. Root and the independent reviewer determine acceptance.
