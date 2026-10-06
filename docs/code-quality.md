# Code quality

Local Husky hooks run format, lint, and hard-ban scans on commit. Unit tests run on push. There is no GitHub Actions workflow for these checks.

## Hooks

`.husky/pre-commit` runs lint-staged (Prettier and ESLint on staged files), then `scripts/check-hard-bans.mjs --staged` on the final index. Temporary indexes supplied by partial Git commits are preserved, and relative index paths resolve from the Git repository root. A resolved merge checks additions against every parent.

`.husky/commit-msg` runs commitlint, then strips matching tool-attribution lines and exits 0 after rewriting the message. A remaining attribution match is an error.

`.husky/pre-push` runs `node scripts/check-hard-bans.mjs --push --hook "$1" "$2"`, then `pnpm run lint`, `pnpm run typecheck`, and `pnpm test`. The checker is the first process to read Git's ref updates from stdin.

<!-- repository-only:start -->

Playwright frontend e2e and CLI combination tests are outside the hook.
<!-- repository-only:end -->

Install hooks with `pnpm install --frozen-lockfile` (`prepare` runs husky). Confirm they are executable with `ls -la .husky/`.

## Hard-ban scan

The dependency-free entry is `scripts/check-hard-bans.mjs`. Policy data, token reasons, paths and limits live in `scripts/guardrails/policy.mjs`; checker and Git logic live beside it. Staged mode scans added lines in the index. Committed-range mode scans from the base and head's merge base. Existing lines are left alone.

It scans `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.sh` case-insensitively, `package.json`, and `.husky` hook scripts. Markdown is skipped so this guide can name the tokens. Policy data is exempt because it contains banned spellings as data.

<!-- repository-only:start -->

This repository also exempts `scripts/check-hard-bans.test.mjs`, which contains legacy token fixtures.
<!-- repository-only:end -->

Checker logic and other tests are scanned. Source files in directories named `node_modules`, `dist`, `.next`, and `.expo` are skipped at every depth. A file named `package.json` is scanned unless its path is protected, including in those skipped directories. `.husky/_/` is skipped.

<!-- repository-only:start -->

Generated Expo output under `mobile/expo/ios/`, `mobile/expo/android/`, and any `.expo/` directory is skipped. Hand-written native source under `mobile/cli/` and `mobile/device-key/` is still scanned.
<!-- repository-only:end -->

A hit fails the hook:

- HTML injection: `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`
- Lint and type suppressions: see the complete token list and reasons in `scripts/guardrails/policy.mjs`
- Type silencing: `as any`, `as unknown as`, `satisfies any`
- Gate muting: `--no-verify`, `--no-typecheck`, `--no-eslint`

A test filename (`*.spec.*`, `*.test.*`, `*.e2e-spec.*`, or `*.harness-spec.*`) may name a DOM token only in a complete, trimmed `expect(receiver).not.toContain('<token>')` or `expect(receiver).not.toMatch("<token>")` line. The optional trailing semicolon is allowed. The receiver must contain no banned token and use balanced parentheses; the literal must name one exact DOM token, occurring exactly once on the line. Quoted text and escapes do not affect delimiter balancing. Unquoted semicolons, slashes and template literals in the receiver are refused, so the exception stays conservative without parsing JavaScript expressions. Extra statements, comments and other arguments are refused. A denial that the formatter wraps across three lines is refused.

The token checker does not parse TypeScript types. Every workspace enforces the explicit-type rule through ESLint's TypeScript parser at error severity for both source and tests.

<!-- repository-only:start -->

The config suite expands the root package's declared workspaces and skips absent packages. It checks the inventoried TypeScript files through ESLint's own config and ignore APIs: the file is not ignored, the type rule is an error, and inline configuration is disabled. This covers inventoried files actually present, not hypothetical future paths or undeclared workspaces. The repository test uses filesystem inventory so its Git subprocesses never target this worktree; explicit project checks can use tracked Git inventory. Filesystem inventory excludes paths ignored by Git ignore files, including files that happen to be tracked. A present workspace with no lintable files fails the check. Without Git, an equivalent filesystem inventory respects the scan skip list and applicable ignore files. Paths are relative to the project root, including projects nested in another repository. The read-only Git inventory preserves global configuration, including ownership exceptions.
<!-- repository-only:end -->

Human-maintained files in the source and test directories selected by `CAPPED_PATH` in the policy must stay at 350 lines or fewer. The guardrail modules and hook entry are also capped.

<!-- repository-only:start -->

This repository caps `backend/src`, `backend/test`, `frontend/src`, `frontend/e2e`, `packages/*/src`, `shared/*/src`, and `mobile/*/(src|app)`.
<!-- repository-only:end -->

Source files remain checked when Git marks them binary or their content includes NUL. Non-source images and gitlinks are excluded from content reads. Other text files under capped directories still receive ceiling checks, except JSON data, Jest snapshots and CSS styles. These three extensions are uncapped because data, recorded output and styles do not have the same implementation ceiling. Non-source content is binary when its first 8000 bytes contain NUL. Source extensions always receive both checks even with NUL.

Mode-only changes to oversized source files are refused because the changed surviving file remains out of policy. CR, LF and CRLF each count as one logical line ending. A pure rename into scan scope from an unscanned, skipped or exempt old path checks every line of the destination. Renames out of a test filename also recheck the denial exceptions.

Known token-scan gaps include identifier escapes, dynamically computed keys, aliasing, shadowed assertion helpers and casts split across lines. Code review owns these cases. Cheap direct spellings of `document.writeln`, optional `document?.write`, and quoted bracket `write` calls are refused. Unknown cast chains also match intervening whitespace or block comments on the same line, one parenthesized receiver and nested angle-bracket casts. UTF-16 source with either byte-order mark is decoded before checking; changed lines in such files use a decoded text diff. Deeper parenthesis combinations, adjacent angle assertions and angle assertions with generic outer types remain outside this token scan. Glued TypeScript suppression descriptions and block ESLint configuration comments with a rule-like name followed by a colon are refused. Ordinary comments about ESLint are allowed. ESLint disables inline configuration in every workspace as a second layer. Dollar-prefixed DOM identifiers and prose false positives retain the existing behavior. The attribution list is unchanged.

## Manual commands

```bash
pnpm run check:bans
node scripts/check-hard-bans.mjs --range <base-commit> <head-commit>
node scripts/check-hard-bans.mjs --all
pnpm run check
pnpm run format
pnpm run lint
pnpm run lint:fix
pnpm run typecheck
pnpm test
```

`--range` resolves both commits, finds their merge base and scans added lines from that commit to the head and checks changed-file lengths at the head commit. Missing or unresolvable commits return exit code 2. `--all` scans tracked and unignored current files for local inventory, without following symlinks or opening protected files. Git modes restrict scanned paths to the project containing the installed script. Invoke them from that project or its enclosing Git repository; the enclosing repository root still produces project-relative paths. A project with its own nested Git repository must instead be invoked in that repository; selecting the outer repository is an error. Production scanning preserves hook repository variables so linked worktrees and detached Git directories retain their context. Relative index paths resolve from the repository root.

<!-- repository-only:start -->

Test fixtures and policy listing clear repository override variables and specify their working directory.
<!-- repository-only:end -->

The pre-push hook passes Git's stdin, destination name and expanded URL to the checker. Empty hook input emits one observation line and returns 0 from the scan; the remaining hook gates still run. Each update supplies local and remote object IDs; only the local ref expression may contain spaces. The checker visits commits reachable from pushed tips, excluding resolvable supplied remote commits and the destination's tracking refs. An explicit configured name takes precedence; otherwise matching configured fetch/push URLs contribute the union of their tracking refs. URL matching uses the expanded hook URL, removes a trailing slash and `.git` suffix, and canonicalizes native local paths and file URLs. For an unknown destination, only configured trusted remotes contribute tracking exclusions. SCP versus SSH spelling, host case and credential normalization are outside this matching rule. Destination matching never echoes URLs or their credentials in checker errors. No network call is made.

A pushed branch's upstream is trusted only when it is a remote-tracking ref owned by the destination or a name in `guardrails.trustedRemotes`, whose default is `origin`. Set that Git config to comma- or whitespace-separated names, or use repeated `git config --add` values; the union replaces the default. An explicitly empty configuration removes the default trust. Unknown explicitly configured remote names are ignored with one warning per distinct name, without printing the name or a possible credential. An absent implicit origin is quiet. When the effective configured set differs from the default, the checker prints one `trusting guardrails.trustedRemotes <names>` line, using `<none>` for an empty set. The standard `origin/main`, `origin/master` and `origin/staging` tracking candidates use the same allowlist. A trusted remote's symbolic `HEAD` can supply its tracking branch even when the default is named `develop` or `trunk`; missing or broken symbols, local-head targets and untrusted namespaces add no baseline. Missing or dangling `origin/HEAD` adds no baseline. Repair it with `git remote set-head origin -a` before choosing the reviewed commit-ID `guardrails.pushBase` fallback below. The longest configured remote-name prefix owns a tracking ref, so trusting `origin` does not trust a separate remote named `origin/nested`. Local branch tips, including `main`, `master` and `staging`, never establish an implicit hook baseline. Unfetched remote objects are omitted from the exclusions so Git can give its own rejection hint. Deletions and tags targeting trees or blobs need no content scan. New side commits and intermediate violations later removed remain checked; merge results are compared with every parent. Push and committed-range reports include the short commit ID.

`git config guardrails.pushBase <commit-ish>` is an explicit opt-in baseline. It trusts everything reachable from the resolved commit, including existing violations, so use it only when deliberately accepting inherited history; later violations remain checked. When a content update applies this baseline, the checker prints `trusting guardrails.pushBase <shortid>`. Branches and `HEAD` move, so such an opt-in trusts newer local changes as the ref moves; prefer the full commit ID of the inherited history you reviewed. Repository, global and environment Git config scopes remain supported, with the same notice. For those updates, invalid or empty values, revision exclusions or ranges, and tree/blob objects return one generic error without echoing the value. This affects authentic hook history scanning; manual empty-input `--push` keeps its separate range behavior.

For each advertised destination branch, a cached tracking ref that disagrees with its remote object ID from stdin is excluded from trust, including aliases leading to it. A new remote branch with a zero ID does not trust a cached counterpart. When a pushed branch's supplied remote commit is unavailable locally, the checker prints fetch-first advice before hit reports and continues its conservative scan. Other stale tracking refs can still hide commits. A tracking ref forged by hand or a local fetch refspec can receive the same trust as a stale one. Tracking names do not prove server provenance, so the hook is a convenience rather than an enforcement boundary. There is no configured CI range workflow here, so that gap currently has no automatic backstop. A first push to an empty destination may check all inherited history when no trusted remote baseline is available. An answers file does not establish trusted provenance. For tag-only history or transfer of reviewed old history to an empty remote, an explicit full commit-ID `guardrails.pushBase` is the deliberate fallback, with the trust warning above. Run `--all` or `--range` separately to inspect the intended content.

For manual `--push` with empty stdin, the checker compares merge bases for the upstream, `origin/HEAD`, local `main`, `master`, `staging`, and their `origin` counterparts. It chooses the base with the fewest commits to HEAD, with a stable object-ID tie break. The current local branch cannot supply its own baseline. Missing, pruned or unrelated upstream candidates fall through to the remaining candidates. If none shares history, a unique reachable root is the manual baseline. This manual fallback omits that root's contents; a CI full-tree `--all` check must cover that limit. Multiple roots are legitimate and are scanned without a baseline. Missing HEAD or unresolvable local objects return exit 2. There is currently no repository CI workflow enforcing the full-tree check.

Git metadata is diffed without path arguments. Content diffs use only eligible changed paths, grouped in bounded literal-path batches, then one blob batch. An edited rename whose old filename becomes a directory uses a separate object-ID diff to avoid selecting excluded descendants. This avoids argument-limit failures without reading protected files or known non-source images. The output buffer is bounded at 64 MiB; overflow returns 2 and asks for a smaller change. An operating-system argument/environment limit failure also returns 2 with instructions to reduce inherited environment size or split the change. Excerpts are capped at 240 characters and centered on the reported token. An overlong filesystem path is skipped with one warning; a tracked file deleted on disk is skipped during a full scan. CR line endings count in both reported lines and the ceiling.

`pnpm run check` is the staged ban scan plus lint and typecheck, without tests. `pnpm test` runs workspace unit tests and retained config checks.

<!-- repository-only:start -->

This repository's default config command includes listed root suites and fast `scripts/guardrails/*.test.mjs` suites. `pnpm run test:config:all` additionally runs every `scripts/guardrails/*.slow.mjs` suite, including real Git histories, hooks and large fixtures. CI should run that complete command. Generated projects retain the runtime checker and inexpensive config checks, and exclude these regression suites and fixture helpers.
<!-- repository-only:end -->

Workspace lint:

```bash
pnpm --filter backend run lint
pnpm --filter frontend run lint
```

Frontend lint also runs the RTL check. Backend uses TypeScript ESLint with `@typescript-eslint/no-explicit-any` as an error. Frontend uses the same `any` rule.

## Commit messages

Messages follow [Conventional Commits](https://conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `revert`.

Choose the scope for the affected workspace or tooling from `commitlint.config.cjs`.

<!-- repository-only:start -->

Scopes: `backend`, `frontend`, `shared`, `mobile`, `packages`, `root`, `docs`, `husky`, `lint-staged`.
<!-- repository-only:end -->

```
feat(backend): add session cookie rotation
```

Do not add `Co-authored-by: Cursor`, `Made-with: Cursor`, `cursoragent@cursor.com`, or `Generated with` plus a model name.

## Tests

Backend unit tests use Jest (`pnpm --filter backend test`). Frontend unit tests use Vitest (`pnpm --filter frontend test`). Backend end-to-end tests use `pnpm --filter backend run test:e2e` and run manually, outside commit and push.

<!-- repository-only:start -->

Frontend end-to-end tests use Playwright (`pnpm --filter frontend run test:e2e`). They run manually, outside commit and push, and are omitted from generated projects.
<!-- repository-only:end -->

## Troubleshooting

If hooks do not run, run `pnpm run prepare` and check that `.husky/pre-commit` is executable.

If commitlint rejects the message, use `<type>(<scope>): <subject>` with an allowed type and scope.

If ESLint blocks the commit, run `pnpm run lint:fix` and fix what remains. Do not add `eslint-disable` comments.

If typecheck fails on push, run `pnpm run typecheck` and fix the types. Use `unknown` with a narrowing check instead of `any`.

If tests fail on push, run `pnpm test` and fix the failures before pushing again.

If the ban scan fails, remove the token from the added line. Fix the underlying issue instead of silencing the checker.

Prettier lives in `.prettierrc` at the repo root. `eslint-config-prettier` turns off ESLint rules that fight Prettier.

## FAQ

Run `pnpm exec lint-staged` followed by `node scripts/check-hard-bans.mjs --staged` to exercise the commit gate without creating a commit.

`pnpm run lint` reports. `pnpm run lint:fix` applies fixes ESLint can make safely.

Change commit types or scopes in `commitlint.config.cjs`.

## Further reading

- [Husky](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/okonet/lint-staged)
- [commitlint](https://commitlint.js.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
