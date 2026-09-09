# create-nest-next-auth

Scaffolds the NestJS + Next.js authentication boilerplate with only the sign-in
methods you pick.

```bash
npx create-nest-next-auth my-app
```

The CLI copies the boilerplate it ships with, deletes the files, env vars and
docs belonging to the methods you left out, then commits the result and installs
dependencies.

## Usage

```bash
npx create-nest-next-auth [directory] [options]
```

The directory can be a name or a path. Its last segment becomes the project
directory and the `name` in the generated root `package.json`. The directory
must not exist, or must be empty. With `--yes` and no directory the CLI uses
`my-app`.

| Option             | What it does                                      |
| ------------------ | ------------------------------------------------- |
| `-y, --yes`        | Take the default methods and skip the prompts     |
| `--features a,b,c` | Use these feature ids and skip the feature prompt |
| `--no-install`     | Skip `npm install`                                |
| `--no-git`         | Skip `git init` and the first commit              |
| `-v, --version`    | Print the CLI version                             |

Without `--yes` or `--features` the CLI asks for a directory and shows the
methods grouped by kind. It needs a terminal for that; in CI, pass a directory
plus `--yes` or `--features`.

Feature ids: `email-password`, `magic-link`, `totp`, `passkeys`, and the
providers `google`, `github`, `facebook`, `microsoft`, `apple`, `discord`,
`linkedin`, `gitlab`, `x`, `slack`, `twitch`, `oidc`. Picking any provider pulls
in `oauth-core`, which is not offered on its own.

```bash
npx create-nest-next-auth my-app --features email-password,google --no-install
```

npm is the only package manager for now. The boilerplate uses npm workspaces and
ships an npm lockfile. The CLI notices when you launch it with pnpm, yarn or bun
and says it is using npm anyway.

## What the CLI does

1. Copies the bundled `template/` into the target directory and restores the
   file names npm strips from a tarball (`.gitignore`, `package-lock.json`).
2. Sets the `name` in the root `package.json`.
3. Deletes the `files` and `docs` of every method you did not pick, plus
   `core.alwaysRemoveFiles`.
4. Deletes the lines and blocks shared files marked for those methods, then
   takes the marker comments off the lines that stay.
5. Removes the env lines those methods own from `backend/.env.example`,
   `.env.docker.example` and `frontend/.env.example`, including the comment
   above a line when it names the method. An env var kept by another selected
   method stays.
6. Drops list items and table rows that link to a deleted doc.
7. Writes `AUTH_FEATURES=<ids>` into `backend/.env.example`.
8. Greps the result for imports of deleted files. Any hit is printed with
   `file:line` and the CLI exits 1, leaving the tree in place.
9. Runs `git init` and one commit, then `npm install`.

Git runs before the install on purpose. The boilerplate installs husky hooks
during `npm install`, and those hooks would run lint-staged over the whole tree
on the first commit.

`AUTH_FEATURES` records what was picked. What ships is decided by the file list
and the markers; the runtime switches are the `*_ENABLED` variables next to it.

## The manifest

`template.manifest.json` lives at the repository root and is copied next to
`template/` when the package is built. It maps each sign-in method to the files
that exist only for it.

```json
{
  "features": {
    "google": {
      "label": "Google",
      "description": "Sign in with a Google account.",
      "kind": "oauth",
      "default": true,
      "files": ["backend/src/auth/strategies/google-oauth.strategy.ts"],
      "envVars": ["OAUTH_GOOGLE_CLIENT_ID"],
      "requires": [],
      "docs": ["docs/setup-google-oauth.md"]
    }
  },
  "core": { "alwaysRemoveFiles": [".hyperflow/**"] }
}
```

| Field         | Meaning                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `label`       | Shown in the prompt                                                                                                          |
| `description` | The hint next to the label                                                                                                   |
| `kind`        | `credential`, `oauth`, `second-factor`, `passwordless`, or `hidden` for an entry another feature requires; groups the prompt |
| `default`     | Preselected in the prompt and picked by `--yes`                                                                              |
| `files`       | Globs, relative to the project root, for files only this method needs                                                        |
| `envVars`     | Env var names stripped from the examples when the method is dropped                                                          |
| `requires`    | Other feature ids pulled in with this one                                                                                    |
| `docs`        | Markdown files deleted with the method, along with links to them                                                             |
| `status`      | `planned` hides the entry from the prompt; omit it for a working method                                                      |

Globs support `?`, `*` and `**`. A path may not start with `/` or contain `..`.

Planned entries exist so the roadmap is visible in one place. They are never
offered and their files, if any are ever listed, are removed from every
generated project.

A `hidden` entry is never shown and never a default. It arrives through another
feature's `requires`, which is how `oauth-core` follows any provider.

## Markers

Deleting a method's files is not enough: the module that registers it, the page
that renders it and the barrel that re-exports it all live in shared files. Those
lines carry a marker naming the feature they belong to, and the CLI deletes them
for a method that was not picked. The markers of the methods that stay are
stripped, so a generated project carries none.

```ts
import { PasskeysModule } from './auth/passkeys/passkeys.module'; // feature:passkeys

// feature:totp:start
import {
  TwoFactorChallenge,
  TwoFactorChallengeSchema,
} from './two-factor/schemas/two-factor-challenge.schema';
// feature:totp:end
```

Rules:

- `// feature:<id>` at the end of a line marks that one line.
- `// feature:<id>:start` and `// feature:<id>:end`, each on a line of its own,
  mark everything between them. A block marker may not share a line with code.
- In JSX use `{/* feature:<id> */}` and `{/* feature:<id>:start */}` /
  `{/* feature:<id>:end */}`. Both forms work in any file; the JSX form is there
  for places where `//` would land inside markup.
- Several ids on one marker, `// feature:totp,passkeys`, mean **any of them**:
  the line stays if at least one is selected. For **all of them**, nest blocks.
- Blocks nest. The `:end` has to name the block it closes.
- Every id has to exist in the manifest, and a marker that names something else
  fails the run with the file and line. That is on purpose: a typo would
  otherwise delete the line from every project.
- Markers are read in `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs` and `.cjs` files.
  JSON and markdown are left alone.

Mark the smallest thing that compiles on its own. An import that only one method
uses, the provider line in a module, the JSX element, the assertion in a spec.
Where removing a line would leave an unused variable or an empty block, mark the
variable and the block too, or move the shared part out of the feature's reach,
the way `TWO_FACTOR_CLIENT_PATH` sits in `common/constants/client-paths.ts`.

### Adding a method

1. Land the code in the boilerplate, keeping everything the method owns inside
   its own directory.
2. Add the entry, listing every file that belongs to that method alone and every
   env var it reads.
3. Mark the lines shared files needed for it.
4. Add the combination to `test/combinations.slow.test.ts` and run
   `npm run test:combinations -w packages/create-nest-next-auth`. It scaffolds a
   project per combination and typechecks both workspaces, and it checks that a
   project with everything selected matches the repository with the markers
   taken off.

The reference check is the other honest signal. If dropping a method leaves an
import pointing at a deleted file, either the file is shared and does not belong
in `files`, or the line needed a marker.

## Maintainer notes

The published package carries the whole boilerplate in `template/`. That
directory is generated, gitignored, and rebuilt from the repository on every
build.

```bash
npm run build -w packages/create-nest-next-auth   # sync-template.mjs, then tsdown
npm run test -w packages/create-nest-next-auth
npm run test:combinations -w packages/create-nest-next-auth   # slow, runs in CI
npm pack -w packages/create-nest-next-auth --dry-run
npm publish -w packages/create-nest-next-auth --dry-run
```

`test:combinations` scaffolds one project per feature combination into a temp
directory, borrows the repository's `node_modules` through a symlink and runs
`tsc --noEmit` over both workspaces. `.github/workflows/ci.yml` runs it as the
`scaffold-combinations` job, which is skipped outside this repository because
generated projects carry the workflow but not the CLI.

The full-feature browser suite is maintainer tooling. Generated projects omit `frontend/e2e`, both Playwright configurations and the backend browser/consent helpers. Their frontend package omits the corresponding `test:e2e` scripts. Product unit tests and the disposable backend functional API suite remain available. The source repository and its CI retain all browser coverage.

`prebuild` runs `scripts/sync-template.mjs`, which copies the repository into
`template/` while skipping `node_modules`, `.git`, `dist`, `.next`, `out`,
`coverage`, logs, real `.env` files, `packages/`, maintainer folders
(`.hyperflow`, `.claude`, `openspec`) and this package's publish workflow.
`.github/workflows/ci.yml` is kept. Build before publishing; a stale or missing
`template/` produces a package that cannot scaffold anything.

Publishing is a tag push. `create-nest-next-auth@0.1.0` triggers
`.github/workflows/publish-cli.yml`, which checks the tag against the version in
`package.json`, builds, and runs `npm publish --provenance --access public`
through npm trusted publishing. No token is stored in the repository.

Requires Node 22.12 or newer, for both the CLI and the generated project.
