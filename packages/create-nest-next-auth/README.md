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

| Option             | What it does                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `-y, --yes`        | Take the defaults and skip the prompts                               |
| `--features a,b,c` | Use these feature ids and skip the feature prompt                    |
| `--targets a,b,c`  | Client ids; only `web` is available today                            |
| `--database <id>`  | Database id; only `mongodb` is available today                       |
| `--preset <id>`    | Apply a preset: `minimal`, `standard`, `everything`                  |
| `--config <file>`  | JSON file with the same selection keys                               |
| `--locales <list>` | Locale ids; `en` is required, `en,ar` adds Arabic                    |
| `--no-docker`      | Leave out the Docker files and the commands that run them            |
| `--no-production`  | Leave out nginx, the production compose file and the production docs |
| `--dry-run`        | Print the resolved plan and write nothing                            |
| `--no-install`     | Skip `npm install`                                                   |
| `--no-git`         | Skip `git init` and the first commit                                 |
| `-v, --version`    | Print the CLI version                                                |

Without `--yes`, `--features`, `--targets`, `--database`, `--preset` or `--config`
the CLI asks for a directory and shows the methods grouped by kind. It needs a
terminal for that.

Feature ids: `email-password`, `magic-link`, `totp`, `passkeys`, and the
providers `google`, `github`, `facebook`, `microsoft`, `apple`, `discord`,
`linkedin`, `gitlab`, `x`, `slack`, `twitch`, `oidc`. Picking any provider pulls
in `oauth-core`, which is not offered on its own.

```bash
npx create-nest-next-auth my-app --features email-password,google --no-install
```

### Ids and exit codes

An unknown id, or an id that is not available yet, in `--features`, `--targets`,
`--database`, `--locales`, `--preset` or the config file stops the run with exit
code 2 before anything is written or asked. This replaces the older behaviour
where an unknown `--features` id was skipped with a warning. Other usage errors
(a bad flag value, a missing or invalid config file, a wrong type, an unknown
key) also exit 2. Exit 1 is for a run that failed after scaffolding, such as a
leftover import. Exit 3 means the installed package itself is damaged, for
example a missing or malformed identity file or package manifest. Reinstall it
and run again.

### Config file

`--config` reads a JSON object with these keys, all optional:

```json
{
  "targets": ["web"],
  "database": "mongodb",
  "features": ["email-password", "google"],
  "locales": ["en", "ar"],
  "docker": true,
  "production": true,
  "preset": "standard"
}
```

A flag overrides the config file, the config file overrides the preset, and the
preset overrides the manifest defaults. A UTF-8 byte order mark is accepted and
stripped.

### Presets

- `minimal`: `web`, `email-password`, no options.
- `standard` (the default): `web`, the default features, every option.
- `everything`: every available client, feature and option.

A preset never makes an unavailable id available. Planned targets, databases and
options stay as the manifest defines them.

### Dry run

`--dry-run` resolves the selection, prints the summary and exits 0 without
copying, pruning, installing or committing anything.

npm is the only package manager for now. The boilerplate uses npm workspaces and
ships an npm lockfile. The CLI notices when you launch it with pnpm, yarn or bun
and says it is using npm anyway.

## What the CLI does

1. Copies the bundled `template/` into the target directory and restores the
   file names npm strips from a tarball (`.gitignore`, `package-lock.json`).
2. Sets the `name` in the root `package.json`.
3. Deletes the `files` and `docs` of every method and option you did not pick,
   plus `core.alwaysRemoveFiles`.
4. Deletes the lines and blocks shared files marked for those methods and
   options, then takes the marker comments off the lines that stay.
5. Removes the env lines those methods own from `backend/.env.example`,
   `.env.docker.example` and `frontend/.env.example`, including the comment
   above a line when it names the method. An env var kept by another selected
   method stays.
6. Drops list items and table rows that link to a deleted doc.
7. Writes `AUTH_FEATURES=<ids>` into `backend/.env.example`.
8. Removes the root scripts that run a deleted file, strips deleted files from
   `node --test` lists, drops dependabot docker entries whose Dockerfile is gone
   and removes the catalogue keys an option owns.
9. Formats every file it changed with the generated project's own prettier
   configuration, so a fresh scaffold passes its own lint.
10. Greps the result for imports and scripts that point at deleted files. Any
    hit is printed with `file:line` and the CLI exits 1, leaving the tree in
    place.
11. Writes `.create-nest-next-auth.json` into the project root. It records the
    installer name and version, a SHA-256 of the template content the project
    was generated from, and the resolved selection: clients, database,
    features, options and locales. It holds no secrets, no paths and no
    machine names, so keep it committed with the project.
12. Runs `git init` and one commit, then `npm install`.

Git runs before the install on purpose. The boilerplate installs husky hooks
during `npm install`, and those hooks would run lint-staged over the whole tree
on the first commit.

`AUTH_FEATURES` records what was picked. What ships is decided by the file list
and the markers; the runtime switches are the `*_ENABLED` variables next to it.

## The manifest

`template.manifest.json` lives at the repository root and is copied next to
`template/` when the package is built. Version 2 maps five dimensions: `targets`
(clients), `shared` modules, `databases`, `options` and `features` (sign-in
methods), plus `presets`. A version 1 file still loads and is read as version 2
with `web`, `mongodb` and no options.

```json
{
  "version": 2,
  "targets": {
    "web": { "label": "Web app (Next.js)", "default": true, "files": ["frontend/**"] },
    "native-expo": {
      "label": "Mobile app, Expo",
      "default": false,
      "status": "planned",
      "requires": { "shared": ["native-core"], "targets": [] },
      "needsSignInSite": true
    }
  },
  "shared": {
    "native-core": { "files": ["mobile/core/**"], "workspaces": ["mobile/core"] }
  },
  "databases": {
    "mongodb": { "label": "MongoDB", "default": true, "files": [], "envVars": ["MONGO_URI"] },
    "postgres": { "label": "PostgreSQL", "default": false, "status": "planned" }
  },
  "options": {
    "docker": {
      "label": "Docker files",
      "default": true,
      "files": [
        "docker-compose.yml",
        "backend/Dockerfile",
        "frontend/Dockerfile",
        ".dockerignore",
        ".env.docker.example"
      ],
      "catalogueKeys": []
    },
    "production": {
      "label": "Production nginx and compose",
      "default": true,
      "requires": ["docker"],
      "files": ["nginx/**", "docker-compose.prod.yml", "docs/deployment.md"],
      "catalogueKeys": []
    },
    "locale-ar": {
      "label": "Arabic locale",
      "default": true,
      "files": ["frontend/src/i18n/messages/**/*.ar.json"],
      "catalogueKeys": [
        {
          "path": "frontend/src/i18n/messages/en.json",
          "keys": ["common.switchToArabic"]
        }
      ]
    }
  },
  "presets": {
    "minimal": { "targets": ["web"], "features": ["email-password"], "options": [] },
    "standard": {
      "targets": ["web"],
      "features": "defaults",
      "options": ["docker", "production", "locale-ar"]
    },
    "everything": { "targets": "available", "features": "available", "options": "available" }
  },
  "features": {
    "google": {
      "label": "Google",
      "description": "Sign in with a Google account.",
      "kind": "oauth",
      "default": true,
      "files": ["backend/src/auth/oauth/strategies/google-oauth.strategy.ts"],
      "envVars": ["OAUTH_GOOGLE_CLIENT_ID"],
      "requires": ["oauth-core"],
      "docs": ["docs/setup-google-oauth.md"]
    }
  },
  "core": { "alwaysRemoveFiles": [".hyperflow/**"] }
}
```

| Field           | Meaning                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `label`         | Shown in the prompt                                                                                                          |
| `description`   | The hint next to the label                                                                                                   |
| `kind`          | `credential`, `oauth`, `second-factor`, `passwordless`, or `hidden` for an entry another feature requires; groups the prompt |
| `default`       | Preselected in the prompt and picked by `--yes`                                                                              |
| `files`         | Globs, relative to the project root, for files only this method needs                                                        |
| `envVars`       | Env var names stripped from the examples when the method is dropped                                                          |
| `requires`      | Other feature ids pulled in with this one                                                                                    |
| `docs`          | Markdown files deleted with the method, along with links to them                                                             |
| `catalogueKeys` | For an option: catalogue paths and dotted keys removed when it is off                                                        |
| `status`        | `planned` hides the entry from the prompt and from `--features`; omit it for a working method                                |

`targets`, `databases` and `options` share `label`, `default` and `status`. A
target also has `files`, `workspaces`, `envFiles`, `requires` (with `shared` and
`targets` lists) and `needsSignInSite`. A database has `files`, `envVars` and
`composeServices`. An option has `files`, `requires`, `docs` and
`catalogueKeys`.

A preset says which ids to start from. Each field is a list of ids, `"available"`
for every available id, or `"defaults"` for the manifest defaults.

Globs support `?`, `*` and `**`. A path may not start with `/` or contain `..`.

`status: "planned"` marks an id the manifest knows but the CLI does not offer
yet. A planned id is never prompted and is an error if a flag or the config file
names it. Planned targets, databases and options do not list files; the change
that makes one available adds its files at the same time. A planned database or
option still has a fixed state, its `default`. Asking for that same state is
accepted, and asking for the opposite is an error. All three options ship today:
`docker`, `production` and `locale-ar` each list the files they own, and turning
one off removes those files, its markers and its root scripts.

Options own their lines the same way features do: a `// feature:docker` marker,
a markdown `<!-- feature:docker:start -->` block, or a root `package.json`
script that runs Docker. `production` requires `docker`; asking for
`--no-docker` while production is still on is a usage error, not a silent drop.

Turning Arabic off removes the `ar` locale, the Arabic catalogues and their
tests. The `rtl:` utility variants, the direction provider and the `lint:rtl`
direction-safe check stay, because the English UI still uses them; the option is
about the language, not about stripping direction support.

A `hidden` feature is never shown, never a default and cannot be requested by
id. It arrives through another feature's `requires`, which is how `oauth-core`
follows any provider.

## Markers

Marker rules, and how to add a method, live in [docs/markers.md](docs/markers.md).

## Maintainer notes

The published package carries the whole boilerplate in `template/`. That
directory is generated, gitignored, and rebuilt from the repository on every
build.

```bash
npm run build -w packages/create-nest-next-auth   # sync-template.mjs, then tsdown
npm run test -w packages/create-nest-next-auth
npm run test:combinations -w packages/create-nest-next-auth   # slow
npm pack -w packages/create-nest-next-auth --dry-run
npm publish -w packages/create-nest-next-auth --dry-run
```

`test:combinations` scaffolds one project per feature combination into a temp
directory, borrows the repository's `node_modules` through a symlink and runs
`tsc --noEmit` over both workspaces.

The full-feature browser suite is maintainer tooling. Generated projects omit `frontend/e2e`, both Playwright configurations and the backend browser/consent helpers. Their frontend package omits the corresponding `test:e2e` scripts. Product unit tests and the disposable backend functional API suite remain available. The source repository retains all browser coverage.

`prebuild` runs `scripts/sync-template.mjs`, which copies the repository into
`template/` while skipping `node_modules`, `.git`, `dist`, `.next`, `out`,
`coverage`, logs, real `.env` files, `packages/`, and maintainer folders
(`.hyperflow`, `.claude`, `openspec`). The same script writes
`template.identity.json` beside `template/`: the SHA-256 of the shipped file
list, contents and executable bits, which every generated project records in
`.create-nest-next-auth.json`. Build before publishing; a stale or missing
`template/` produces a package that cannot scaffold anything.

Publish from the package directory after a version bump: `npm run build -w
packages/create-nest-next-auth`, then `npm publish --access public` from
`packages/create-nest-next-auth`.

Requires Node 22.12 or newer, for both the CLI and the generated project.
