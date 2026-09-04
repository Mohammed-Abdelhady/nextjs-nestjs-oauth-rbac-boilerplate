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

Feature ids available today: `email-password`, `google`, `github`, `facebook`.

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
4. Removes the env lines those methods own from `backend/.env.example`,
   `.env.docker.example` and `frontend/.env.example`, including the comment
   above a line when it names the method. An env var kept by another selected
   method stays.
5. Drops list items and table rows that link to a deleted doc.
6. Writes `AUTH_FEATURES=<ids>` into `backend/.env.example`.
7. Greps the result for imports of deleted files. Any hit is printed with
   `file:line` and the CLI exits 1, leaving the tree in place.
8. Runs `git init` and one commit, then `npm install`.

Git runs before the install on purpose. The boilerplate installs husky hooks
during `npm install`, and those hooks would run lint-staged over the whole tree
on the first commit.

`AUTH_FEATURES` is written but nothing reads it yet. Turning methods on and off
at runtime is a separate task in the boilerplate; today the file list is what
decides what ships.

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

| Field         | Meaning                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `label`       | Shown in the prompt                                                         |
| `description` | The hint next to the label                                                  |
| `kind`        | `credential`, `oauth`, `second-factor` or `passwordless`; groups the prompt |
| `default`     | Preselected in the prompt and picked by `--yes`                             |
| `files`       | Globs, relative to the project root, for files only this method needs       |
| `envVars`     | Env var names stripped from the examples when the method is dropped         |
| `requires`    | Other feature ids pulled in with this one                                   |
| `docs`        | Markdown files deleted with the method, along with links to them            |
| `status`      | `planned` hides the entry from the prompt; omit it for a working method     |

Globs support `?`, `*` and `**`. A path may not start with `/` or contain `..`.

Planned entries exist so the roadmap is visible in one place. They are never
offered and their files, if any are ever listed, are removed from every
generated project.

### Adding a method

1. Land the code in the boilerplate.
2. Add or fill in the entry, listing every file that belongs to that method
   alone and every env var it reads.
3. Drop `"status": "planned"`.
4. Run the tests. Scaffold once without the new method and confirm the
   reference check stays quiet.

The reference check is the honest signal. If dropping a method leaves an import
pointing at a deleted file, either the file is shared and does not belong in
`files`, or the code needs to resolve that method through the provider registry
instead of importing it.

## Maintainer notes

The published package carries the whole boilerplate in `template/`. That
directory is generated, gitignored, and rebuilt from the repository on every
build.

```bash
npm run build -w packages/create-nest-next-auth   # sync-template.mjs, then tsdown
npm run test -w packages/create-nest-next-auth
npm pack -w packages/create-nest-next-auth --dry-run
npm publish -w packages/create-nest-next-auth --dry-run
```

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
