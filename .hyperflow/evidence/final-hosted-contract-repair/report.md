# Hosted contract repair

Status: **FROZEN FOR INDEPENDENT RECHECK**. No commit or push. Base is `954b99a319d171d8dd488372fda6f4f530440dce`.

| Assigned finding   | Implementation and evidence                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI-BROWSER-PRODUCT | Dashboard flex column can shrink; header wraps naturally without clipping or removing controls. The unfocused skip link has a logical inset, preserving focused placement and Enter navigation.                                         |
| CI-DOCKER-SSR      | HTTP probes validate the actual localized accessible SSR loading shell and Next bootstrap. Hydrated login forms remain a browser assertion. Existing status, Location presence, timeout, response limits and endpoint contracts remain. |

Only the five approved paths changed; `manifest.json` records their hashes and `repair.patch` the complete delta. The fingerprint is `221cdad95491ce949f4a7c6b005435c4894e2b8b3aa7ea71bd1318ff7d7ee16a`. Existing diagnostic helper and workflow are unchanged. Original checkout source was not edited.

## Causal and final evidence

Hosted geometry at the base showed document 392 at viewport 390 in RTL, with the dashboard flex column at 391.84375px. Native fonts differ: the controlled pre-edit capture at 385 reproduced document 387. Setting the shell minimum width to zero brought the document to 385; wrapping the header retained every control within bounds. The skip link's 1 px box moved inside the viewport with a logical inset. See `diagnostic-output/diagnose-SSR-and-controlled-geometry/geometry-ssr.json` and its before/controlled screenshots.

Final source geometry is in `final-geometry-output/`, with en/ar screenshots at 1280,390,385 and 320. At every approved 1280/390/385 viewport, the document exactly matches viewport width, and the shell/header stay in bounds. The six browser cases verify visible enabled controls, unobstructed hit targets, control bounds, light/dark/light selection, focus-visible skip navigation and the unchanged strict overflow predicate. Final English and Arabic screenshots were inspected. Header wrapping adds a second row when needed and keeps branding and all actions available.

Both actual native HTTP login routes returned 200 with correct html lang/dir, no form, and a status region marked busy/live with test ID `store-rehydration-loading`. They include Next static scripts and inline bootstrap. `actual-ssr-probe.json` proves the revised helper passes against both actual documents; the other three endpoint responses in that focused check were synthetic, not nginx runtime proof.

## Verification

All commands used retained Node 22.18.0 and the clean allowlisted synthetic environment. The candidate contains only approved examples, never copied real environment files.

| Command                                                                                                | Final result                                                          |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `npm run test:config`                                                                                  | 65/65 PASS; 22 new en/ar SSR negative cases                           |
| `npm run build`                                                                                        | PASS, all workspaces                                                  |
| `npm run lint`                                                                                         | PASS                                                                  |
| `npm run typecheck`                                                                                    | PASS                                                                  |
| `npm run test --workspace frontend`                                                                    | 123/123 PASS                                                          |
| `npm run test:e2e --workspace frontend -- --reporter=line,json`                                        | 76/76 PASS; zero skipped/flaky                                        |
| `npm run test:e2e --workspace frontend -- --config playwright.frontend.config.ts --reporter=line,json` | 44/44 PASS; zero skipped/flaky                                        |
| Focused actual SSR helper check                                                                        | PASS for both live native documents; other endpoints synthetic        |
| Evidence geometry capture                                                                              | 2/2 completed;320 is an observation, not a passing overflow assertion |
| Prettier on five paths; `git diff --check`                                                             | PASS                                                                  |

The SSR matrix rejects blank/error documents, wrong locale/direction, missing shell/status/busy/live attributes, missing static assets/inline bootstrap, and Next error documents in both locales. Positive cases exercise all five checks and serialized child execution. Existing malformed/status/empty-Location/timeout/cancel/output-cap regressions remain passing. No application backend source changed, so the previously passing API/backend/CLI suites were not repeated. No local Docker or denied helper-listener operation was retried. Hosted Docker acceptance remains pending.

### Corrected setup attempts

The first full browser run passed 70/76. All six failures came from a new test assumption that the first theme click must invert the rendered dark class; default `system` legitimately selects light on that click. The regression now verifies the existing light→dark→light behavior. ThemeSwitcher source is unchanged. Full corrected run passed 76/76. Both results are retained in `theme-setup-failed-*` and current `browser-*` files.

The first anonymous invocation referenced a nonexistent config filename and selected no tests. Its log/result remain in `anonymous-incorrect-config*`; the corrected existing config ran 44/44 successfully. The first evidence-only diagnostic import crossed an ESM/CommonJS package boundary; an evidence-local CommonJS package declaration corrected it without candidate changes.

## Open 320 px observation and proposed follow-up

This issue predates the five-path repair. At 320 px the sessions page offers 288px after horizontal padding. Its nonwrapping refresh/revoke-all action row measures 336.64px in English and 355.39px in Arabic. Final document widths are 353 and 371 respectively. Header controls and skip link remain in bounds. The English revoke-all label is cut at the right edge; RTL overflow displaces the visible page and cuts controls/content. Screenshots and individual button rectangles are in the final geometry capture. The sessions source is unchanged from the base.

Proposed separate bounded scope: `frontend/src/app/[locale]/(dashboard)/sessions/page.tsx` plus the existing authenticated regression spec. Allow the existing action group to wrap within available width while retaining complete labels, current button styles, loading/disabled states, focus order and both actions. No hiding, clipping or reduced typography. Each individual button fits the 288px area; no adjacent component minimum-width repair is indicated by this capture. Confirm that during the follow-up rather than assuming every session data shape fits.

Verification should cover en/ar 320 px with two sessions: document width≤viewport, each full button in bounds and independently reachable by keyboard/tap; refresh preserves both session identities; revoke-all opens its existing confirmation dialog and cancel preserves state, then confirmation leaves the current session and removes the other. Check one-session absence of revoke-all and preserve wider 385/390/1280 journeys. This follow-up is proposed only; no source expansion occurred in this batch.

## Quality and stopped boundary

Code Simplifier and integrated Unslop/Humanizer guidance applied. Layout work adds no persistent state or listeners. Geometry/test work is bounded by a fixed control/viewport matrix. SSR checks make a constant number of scans over the existing capped 1 MiB response: linear work and bounded response memory; no performance improvement is claimed. Attribute/script checks intentionally verify this application's emitted SSR contract, not general HTML conformance.

`cleanup.json` records closed command sessions; ports 3107/5107/5108 are free. Fixture teardown completed, no owned service remains, and candidate/runtime are retained. No release, merge, deployment or package publication. Security review/alert details, local denied Docker/helper-listener operations and real credentials remain blocked. `fallback_scope=codex-only` persists. Root owns acceptance and independent recheck.
