# Code quality

Local Husky hooks run format, lint, and hard-ban scans on commit. Unit tests run on push. There is no GitHub Actions workflow for these checks.

## Hooks

`.husky/pre-commit` runs `scripts/check-hard-bans.mjs --staged`, then lint-staged (Prettier and ESLint on staged files).

`.husky/commit-msg` runs commitlint, then rejects Cursor, Claude, or other AI attribution trailers.

`.husky/pre-push` runs `scripts/check-hard-bans.mjs --push`, then `npm run lint`, `npm run typecheck`, and `npm test`. Playwright e2e and CLI combination tests are not in the hook.

Install hooks with `npm install` (`prepare` runs husky). Confirm they are executable with `ls -la .husky/`.

## Hard-ban scan

The checker looks at added lines only (`git diff --cached` on commit, the push range on push). Existing lines are left alone, including older `as unknown as` casts.

It scans `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.sh`, `package.json`, and `.husky` hook scripts. Markdown is skipped so this guide can name the tokens. The checker and its test are skipped because they must mention the tokens. Generated Expo output under `mobile/expo/ios/`, `mobile/expo/android/`, and any `.expo/` directory is skipped. Hand-written native source under `mobile/cli/` and `mobile/device-key/` is still scanned.

A hit fails the hook:

- HTML injection: `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`
- Lint and type suppressions: `eslint-disable`, `eslint-enable`, `prettier-ignore`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, and the other tokens listed in `scripts/check-hard-bans.mjs`
- Type silencing: `as any`, `as unknown as`, `satisfies any`
- Gate muting: `--no-verify`, `--no-typecheck`, `--no-eslint`

A test file (`*.spec.*`, `*.test.*`) may mention a banned token only on a `not.toContain` or `not.toMatch` line, to prove it was stripped.

Human-maintained files under `backend/src`, `backend/test`, `frontend/src`, `frontend/e2e`, `packages/*/src`, `shared/*/src`, and `mobile/*/(src|app)` must stay at 350 lines or fewer. Root scripts already over that cap are not gated yet.

## Manual commands

```bash
npm run check:bans
npm run check
npm run format
npm run lint
npm run lint:fix
npm run typecheck
npm test
```

`npm run check` is the staged ban scan plus lint and typecheck, without tests. `npm test` runs workspace unit tests (Jest, Vitest) and `scripts/*.test.mjs`.

Workspace lint:

```bash
npm run lint -w backend
npm run lint -w frontend
```

Frontend lint also runs the RTL check. Backend uses TypeScript ESLint with `@typescript-eslint/no-explicit-any` as an error. Frontend uses the same `any` rule.

## Commit messages

Messages follow [Conventional Commits](https://conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `revert`.

Scopes: `backend`, `frontend`, `shared`, `mobile`, `packages`, `root`, `docs`, `husky`, `lint-staged`.

```
feat(backend): add session cookie rotation
```

Do not add `Co-authored-by: Cursor`, `Made-with: Cursor`, `cursoragent@cursor.com`, or `Generated with` plus a model name.

## Tests

Backend unit tests use Jest (`npm test -w backend`). Frontend unit tests use Vitest (`npm test -w frontend`). End-to-end tests are `npm run test:e2e -w backend` and `npm run test:e2e -w frontend`. Those are manual. They are not part of commit or push.

## Troubleshooting

If hooks do not run, run `npm run prepare` and check that `.husky/pre-commit` is executable.

If commitlint rejects the message, use `<type>(<scope>): <subject>` with an allowed type and scope.

If ESLint blocks the commit, run `npm run lint:fix` and fix what remains. Do not add `eslint-disable` comments.

If typecheck fails on push, run `npm run typecheck` and fix the types. Use `unknown` with a narrowing check instead of `any`.

If tests fail on push, run `npm test` and fix the failures before pushing again.

If the ban scan fails, remove the token from the added line. Fix the underlying issue instead of silencing the checker.

Prettier lives in `.prettierrc` at the repo root. `eslint-config-prettier` turns off ESLint rules that fight Prettier.

## FAQ

Run `node scripts/check-hard-bans.mjs --staged` and `npx lint-staged` to exercise the commit gate without creating a commit.

`npm run lint` reports. `npm run lint:fix` applies fixes ESLint can make safely.

Change commit types or scopes in `commitlint.config.cjs`.

## Further reading

- [Husky](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/okonet/lint-staged)
- [commitlint](https://commitlint.js.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
