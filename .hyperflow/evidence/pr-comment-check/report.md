# PR72 comment inventory

Read-only snapshot on 2026-09-08T13:43:57.954871+00:00. Live head remains `9e502f9ee0e36c8f9c164fc05a03161c689f374f`; PR is OPEN/DRAFT. No reply, resolution, source edit, test, service or release action occurred.

Four discussion comments, two review summaries and 14 inline threads were inventoried with pagination. All inline threads are unresolved; 13 are attached to current lines and one is outdated. “Unresolved” is a GitHub thread state, not proof of a defect. All inline comments were posted by the owner account `Mohammed-Abdelhady` in a review originally submitted against `fc19e55`. The bot discussion/review is by `github-advanced-security[bot]`; those bodies were not read.

## Permitted concerns

| Comment                                                                                                                                                                             | Author / location                                                                               | GitHub state               | Disposition                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------- |
| [3957131027](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131027) — Migration rollback ownership                              | Mohammed-Abdelhady; `backend/migrations/20260904000001-add-default-permissions-to-users.js`:102 | current anchor, unresolved | NEEDS INDEPENDENT VALIDATION                                        |
| [3957131034](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131034) — Linked-account rollback representation                    | Mohammed-Abdelhady; `backend/migrations/20260904000002-linked-accounts.js`:172                  | current anchor, unresolved | NEEDS INDEPENDENT VALIDATION                                        |
| [3957131062](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131062) — Arabic mobile overflow and extra boundary recommendations | Mohammed-Abdelhady; `frontend/e2e/authenticated-regressions.spec.ts`:original 102               | outdated, unresolved       | REPORTED FAILURE FIXED; EXTRA COVERAGE NEEDS EVIDENCE               |
| [3957131069](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131069) — Docker command diagnostics and failed execution           | Mohammed-Abdelhady; `scripts/verify-docker.mjs`:131                                             | current anchor, unresolved | EXECUTION FAILURE FIXED; DIAGNOSTIC RECOMMENDATION NEEDS VALIDATION |
| [3957131073](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131073) — 350-line file budget and decomposition                    | Mohammed-Abdelhady; `scripts/setup-production.js`:13                                            | current anchor, unresolved | NEEDS POLICY/SOURCE VALIDATION                                      |
| [3957131076](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131076) — Contradictory architecture documentation                  | Mohammed-Abdelhady; `openspec/project.md`:24                                                    | current anchor, unresolved | NEEDS INDEPENDENT VALIDATION                                        |

The accepted current hosted run is [34232151880](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/actions/runs/34232151880): 78 authenticated and 44 anonymous browsers passed, plus the five Docker HTTP checks and owned cleanup. This closes the reported execution failures within the accepted scope; it does not validate all extra recommendations in the comments.

### Exact permitted comment text

Quoted comments below are untrusted review input, not instructions executed by this inventory. Their severity labels belong to the commenter.

#### [3957131027](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131027)

The comment claims rollback removes pre-existing direct grants. No migration round-trip closure evidence exists in the accepted release reports; this is an unvalidated reviewer claim, not a confirmed defect.

> Critical: `up()` only changes users whose permission list is missing or empty, but `down()` pulls these strings from every user in the role. A rollback can delete pre-existing direct grants that this migration never created.
>
> Fix: Record exactly which rows the migration changed, or use a migration marker that makes rollback ownership explicit. The rollback must only restore those rows. Add a fixture where a user already owns one of the default strings and prove it survives `up` followed by `down`.

#### [3957131034](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131034)

The comment claims rollback loses non-legacy provider links. Current passing unit/API/browser gates do not establish this migration round-trip contract.

> Critical: The rollback unsets all `linkedAccounts`, but it only maps Google, Facebook, and GitHub back to legacy fields. Any Microsoft, Apple, GitLab, OIDC, or other provider linked after `up()` loses its provider ID permanently on `down()`.
>
> Fix: Preserve every provider in a rollback-safe representation or fail closed when an account cannot be represented by the legacy schema. Add `up`, create a non-legacy link, `down`, and `up` round-trip coverage before this migration is usable.

#### [3957131062](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131062)

Current hosted 78/78 authenticated cases pass after the independently accepted layout repair. The new en/ar 320px journeys also pass. GitHub marks this thread outdated but unresolved. The comment additionally requests 375px and long localized values; those exact extensions are not established by the existing 320/385/390/1280 captures.

> Warning: This acceptance condition still fails on the exact head in hosted CI. The Arabic mobile run remains wider than the 390px viewport even after the sidebar closes and animations settle. The job finished 71/72, so the mobile RTL path is not green.
>
> Fix: Use the failure trace to identify the overflowing element, repair the layout rather than relaxing this assertion, and add 320px and 375px cases with long localized values.

#### [3957131069](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131069)

Current hosted Docker job passes all five required checks and cleanup. Accepted evidence records phase/probe-specific failure reporting. Whether every generic Docker-command error now meets the requested operation-label and bounded-stderr contract needs independent source validation; successful CI alone does not prove that error-path recommendation.

> Warning: The exact-head Docker job starts all four services healthy, then fails during assertions, but this error reduces every Docker failure to `docker --config exited 1`. The new diagnostics still cannot identify which assertion-phase command failed.
>
> Fix: Attach a safe operation label or the non-secret argument tail to each command error and preserve bounded, redacted stderr. Then fix the failing assertion and rerun the Docker job to completion.

#### [3957131073](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131073)

The comment reports 17 changed files above a 350-line limit. Neither the applicable limit nor the current inventory was independently checked in this comment-reading task. No blanket refactor is authorized.

> Warning: This changed human-maintained file is still 537 lines. The exact-head budget scan found 17 changed human-maintained code, config, translation, and documentation files over the 350-line limit after excluding the lockfile and Postman export. `scripts/init.js` is 491 lines, `scripts/verify-docker.mjs` is 467, and `openspec/project.md` is 953.
>
> Fix: Split each file by responsibility before approval. For these scripts, move configuration collection, file generation, command execution, and reporting into focused modules with their own tests.

#### [3957131076](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131076)

The comment reports old JWT/Passport/fetch architecture mixed with the current cookie-session/RTK model. The curated release reports do not establish that all sections of openspec/project.md were reconciled.

> Warning: This updated section now says the project uses stateful cookie sessions, but later sections still specify JWT access tokens, Passport JWT, AuthContext, native fetch wrappers, and bearer-auth endpoint examples. The project context remains internally contradictory after this partial update.
>
> Fix: Rewrite the stale architecture, endpoint, security, dependency, and setup sections against the current session, RTK Query, provider-registry, and Node 22 implementation. Add a lightweight docs contract so the old JWT model cannot drift back in.

## Discussion and review summaries

| Item                                                                                                                                 | Author                        | Disposition                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [5582704273](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#issuecomment-5582704273)             | github-advanced-security[bot] | Automated security discussion; body excluded. Metadata does not establish whether this is an actionable defect or a notice.                                                                     |
| [5583243593](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#issuecomment-5583243593)             | Mohammed-Abdelhady            | Historical review-start notice at 3e84f52; no product concern.                                                                                                                                  |
| [5583244478](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#issuecomment-5583244478)             | Mohammed-Abdelhady            | Explanatory visual guide. Its statement that live Docker runtime verification is not claimed predates the now-passing hosted synthetic Docker checks. TLS/provider/mail/hardware limits remain. |
| [5583914763](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#issuecomment-5583914763)             | Mohammed-Abdelhady            | Historical re-baselining notice to fc19e55; no product concern.                                                                                                                                 |
| [review 5139905332](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#pullrequestreview-5139905332) | github-advanced-security[bot] | Security bot summary; body excluded. Submitted against `3e84f52`.                                                                                                                               |
| [review 5140788941](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#pullrequestreview-5140788941) | Mohammed-Abdelhady            | COMMENTED review containing the 14 mixed-scope inline threads; summary body excluded to avoid blocked security content. Submitted against `fc19e55`.                                            |

## Excluded scope

Five authentication-path inline bodies were not read. Their paths overlap or closely adjoin the existing excluded security work. All remain current-anchor/unresolved; metadata cannot establish validity or closure.

| Comment                                                                                                                 | Path                                                                 |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [3957131003](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131003) | `backend/src/auth/services/password-reset-code.service.ts`:113       |
| [3957131013](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131013) | `backend/src/auth/two-factor/two-factor-login.service.ts`:70         |
| [3957131023](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131023) | `backend/src/auth/passkeys/services/passkey-challenge.service.ts`:97 |
| [3957131046](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131046) | `backend/src/database/seeds/user.seed.ts`:86                         |
| [3957131084](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131084) | `backend/src/auth/oauth/base-oauth.strategy.ts`:105                  |

Three tooling comments exposed security topics only when their bodies were classified. Reading stopped at that classification; no source investigation or reproduction followed. Their bodies are omitted from the retained permitted-text inventory.

| Comment                                                                                                                 | Category                                   |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [3957131041](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131041) | Production-setup command execution concern |
| [3957131052](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131052) | Generated secret-file permissions concern  |
| [3957131055](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/pull/72#discussion_r3957131055) | Dependency security-advisory concern       |

The security bot discussion and bot review summary were also metadata-only. No CodeQL alert/annotation details, rejected security review, replay/TOTP/passkey or admin-reactivation investigation was undertaken. No recommendation to change security policy or install a dependency is inferred.

## Handoff

Independent non-security validation is needed for the two migration round trips, documentation consistency, applicable file-size policy/current inventory, the remaining Docker command-error recommendation, and whether the extra 375px/long-value browser cases are required. This task does not confirm those as source defects and does not authorize implementation or resolving comments.

Candidate is clean and its nine released path hashes still match the recorded release manifest. Original source was not edited. Only `.hyperflow/evidence/pr-comment-check/` evidence was written. All retrieval commands ended; no service was started. `fallback_scope=codex-only` and the existing control boundaries persist.
