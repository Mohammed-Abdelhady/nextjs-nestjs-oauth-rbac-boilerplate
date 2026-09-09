# Production hardening

Draft — **NOT READY for release**. Local verification completed on 2026-09-08; full independent review and production runtime verification remain blocked or pending. The [137-finding audit ledger](audit-status.md) preserves each historical finding’s disposition separately.

## Completed local scope

| Plan | Completed work                                                                                                                                                                                                                                                                                                                                   | Remaining boundary                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| T21  | Disposable database/API fixtures; anonymous and authenticated browser journeys; English/Arabic desktop/mobile core lifecycle coverage; representative accessibility checks; repairs for startup, navigation, persistence, destination routing, localized errors, document direction, accessible labels, contrast and bodyless deletion responses | Independent review remains pending; live external integrations are not covered                                                                      |
| T29b | Authentication feature pruning and generated password enablement; marker boundary tests; packed CLI tests; generated combination typechecks and runtime feature checks; package creation and publication dry run                                                                                                                                 | Seven generated selections are representative, not every possible provider combination; generated-template repair awaits independent post-PR review |
| T30  | CI integration commands and sequential browser jobs; filtered Docker context, HTTP health route and disposable runtime helper; template artifact exclusions; complete audit disposition inventory                                                                                                                                                | Hosted CI, real Docker startup/health/cleanup and production TLS remain unverified                                                                  |

The browser fixtures use an owned disposable Mongo instance, synthetic configuration and a local mail sink. Tests cover actual registration, activation, password reset, profile save/reload, signout, sessions, role navigation, ordinary allowed/denied administration and soft deletion. The local OAuth adapter exercises the application’s start/callback/session/profile chain, including success, cancellation and error recovery. Magic-link cases cover valid and explicitly expired fixtures. Network cases use actual local connection refusal and verify translated messages, both locale transitions and recovery.

Two deliberate test contracts apply. Authenticated cases sign in through the real local flow after each reset because resets invalidate saved sessions; reusable `storageState` is not claimed. The full browser harness remains maintainer-only in the source repository, CI and Docker context. Generated projects retain product unit tests and functional backend API tests; their package scripts omit unavailable browser commands, and their documentation states this boundary.

## Final verification

The final run used official Node 22.18.0 with its archive checksum verified, npm 10.9.3, Playwright 1.57.0 and installed Chrome 152. A fresh isolated `npm ci` passed with lifecycle scripts enabled and the lockfile unchanged. Earlier runtime-download failures are superseded by this result.

Commands below ran from an isolated repository copy with real environment files excluded, an allowlisted process environment, empty npm user/global configuration and synthetic application values. Browser runs used `NEXT_PUBLIC_API_URL=http://127.0.0.1:5107` and `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome`. `<artifact-directory>` replaces only the local output path.

| Command                                                                                          | Final result                                                                                             |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                                                         | PASS; 1,435 packages, lock unchanged                                                                     |
| `npm run build`                                                                                  | PASS; backend, frontend (43 routes), CLI                                                                 |
| `npm run lint`                                                                                   | PASS; all workspaces                                                                                     |
| `npm run typecheck`                                                                              | PASS; all workspaces                                                                                     |
| `npm test -w backend -- --runInBand`                                                             | 708/708; 83 suites                                                                                       |
| `npm test -w frontend`                                                                           | 123/123; 17 files                                                                                        |
| `npm run test:e2e -w backend -- --runInBand`                                                     | 72/72; 6 suites                                                                                          |
| `node node_modules/@playwright/test/cli.js test --config frontend/playwright.frontend.config.ts` | 44/44 anonymous cases                                                                                    |
| `node node_modules/@playwright/test/cli.js test --config frontend/playwright.config.ts`          | 68/68 application cases                                                                                  |
| `npm test -w packages/create-nest-next-auth`                                                     | 99/99 packed CLI tests                                                                                   |
| `npm run test:combinations -w packages/create-nest-next-auth`                                    | 9/9; seven selections, both workspace typechecks, feature checks and retained-file full-selection parity |
| `npm pack -w packages/create-nest-next-auth --pack-destination <artifact-directory>`             | PASS; tarball created                                                                                    |
| `npm publish --dry-run -w packages/create-nest-next-auth`                                        | PASS; no files uploaded                                                                                  |

All 112 browser cases executed with zero retries and no skipped or unrun cases. Sixteen representative axe captures reported zero WCAG A/AA violations without rule or content exclusions; this does not establish exhaustive accessibility or AAA conformance. Owned database and application processes were stopped, and dedicated ports 3107, 5107 and 5108 were free after verification.

T30-OP-001 received an independent static recheck: retaining the browser fixture in the Docker context removed the missing-module error, and the filtered context had no unresolved local imports. Its helper checks recorded 20 passes and 13 blocked listener cases. This establishes the source repair, not Docker runtime behavior. T30-CLI-002 passed its generated-template regressions and combination gates; independent post-PR review remains pending.

## Release limits

- The independent security review stopped at an explicit control rejection. Its paused findings remain uninvestigated and unclosed. Other historical audit rows without exact review evidence still require independent review.
- Docker socket access and the operational helper’s listener were denied. Production images, actual container health and cleanup, TLS and certificate renewal have not been verified.
- Local provider adapters and captured mail establish application integration. They do not establish live OAuth protocol conformance, external mail delivery or passkey hardware behavior.
- The fresh install reported dependency advisories; no new dependency audit or remediation is claimed.
- Hosted CI and the full independent post-PR review have not run. No package publication, merge or deployment occurred.
