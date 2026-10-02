# Installer: choose clients, database and features

| Field   | Value                                                                         |
| ------- | ----------------------------------------------------------------------------- |
| Status  | Spec, ready for implementation (PR B)                                         |
| Date    | 2026-10-01                                                                    |
| Package | `packages/create-nest-next-auth`, manifest `template.manifest.json`           |
| Rule    | An option is offered only when the generated project passes its gates with it |

## TL;DR

The installer asks four things: which clients, which database, which sign-in methods, and a few project
options. Every answer can also be given as a flag or in a config file, so the same run works in a
terminal and in CI. Choices that depend on each other are resolved by one pure function that explains
what it added and why. Options that are not built yet exist in the manifest as `planned` and are never
offered.

## What the user sees

```
◆ Where should the project go?            my-app
◆ Which clients do you want?
  ◼ Web app (Next.js)
  ◻ Mobile app, Expo
  ◻ Mobile app, React Native CLI
◆ Which database?
  ● MongoDB
  ○ PostgreSQL
◆ Which sign-in methods do you want?      (the existing grouped list)
◆ Project options
  ◼ Docker files
  ◼ Production nginx and compose
  ◼ Arabic and right-to-left support
◇ Summary
  Clients    web, mobile (Expo)
  Database   MongoDB
  Sign-in    email and password, Google, GitHub
  Added      web sign-in pages, needed by the mobile app
```

A mobile choice without the web app keeps the sign-in website and says so in the summary. The mobile
app signs in through the browser, so those pages must exist.

## Flags and config file

| Flag                             | Values                                 | Default           |
| -------------------------------- | -------------------------------------- | ----------------- |
| `--targets <list>`               | `web`, `native-expo`, `native-cli`     | `web`             |
| `--database <id>`                | `mongodb`, `postgres`                  | `mongodb`         |
| `--features <list>`              | feature ids, as today                  | manifest defaults |
| `--preset <id>`                  | `minimal`, `standard`, `everything`    | `standard`        |
| `--no-docker`                    |                                        | docker on         |
| `--no-production`                |                                        | production on     |
| `--locales <list>`               | `en`, `ar`                             | `en,ar`           |
| `--config <file>`                | JSON with the same keys                | none              |
| `--dry-run`                      | print the resolved plan, write nothing | off               |
| `-y`, `--no-install`, `--no-git` | as today                               |                   |

Order of precedence: explicit flag, then config file, then preset, then manifest default. An unknown id
or a `planned` id given by flag or file is an error with exit code 2 and a message that names it. The
prompt never shows it.

## Manifest version 2

```jsonc
{
  "version": 2,
  "targets": {
    "web": {
      "label": "Web app (Next.js)",
      "default": true,
      "files": ["frontend/**"],
      "workspaces": ["frontend"],
      "envFiles": ["frontend/.env.example"],
    },
    "native-expo": {
      "label": "Mobile app, Expo",
      "default": false,
      "status": "planned",
      "files": ["mobile/expo/**"],
      "workspaces": ["mobile/expo"],
      "requires": { "shared": ["native-core"], "targets": [] },
      "needsSignInSite": true,
    },
    "native-cli": {
      "label": "Mobile app, React Native CLI",
      "default": false,
      "status": "planned",
      "files": ["mobile/cli/**"],
      "workspaces": ["mobile/cli"],
      "requires": { "shared": ["native-core"] },
      "needsSignInSite": true,
    },
  },
  "shared": {
    "native-core": {
      "files": ["mobile/core/**", "mobile/device-key/**"],
      "workspaces": ["mobile/core", "mobile/device-key"],
    },
  },
  "databases": {
    "mongodb": {
      "label": "MongoDB",
      "default": true,
      "files": ["backend/src/persistence/mongo/**", "backend/migrations/**"],
      "envVars": ["MONGO_URI"],
      "composeServices": ["mongodb"],
    },
    "postgres": {
      "label": "PostgreSQL",
      "default": false,
      "status": "planned",
      "files": ["backend/src/persistence/postgres/**", "backend/drizzle/**"],
      "envVars": ["DATABASE_URL"],
      "composeServices": ["postgres"],
    },
  },
  "options": {
    "docker": {
      "label": "Docker files",
      "default": true,
      "files": ["docker-compose.yml", "**/Dockerfile", ".dockerignore"],
    },
    "production": {
      "label": "Production nginx and compose",
      "default": true,
      "requires": ["docker"],
      "files": ["nginx/**", "docker-compose.prod.yml"],
    },
    "locale-ar": {
      "label": "Arabic and right-to-left support",
      "default": true,
      "files": ["**/messages/*ar.json"],
    },
  },
  "presets": {
    "minimal": { "targets": ["web"], "features": ["email-password"], "options": [] },
    "standard": {
      "targets": ["web"],
      "features": "defaults",
      "options": ["docker", "production", "locale-ar"],
    },
    "everything": { "targets": "available", "features": "available", "options": "available" },
  },
  "features": { "…": "unchanged from version 1, plus an optional `targets` list per feature" },
  "core": { "alwaysRemoveFiles": [] },
}
```

A version 1 manifest still loads: it is read as version 2 with `web`, `mongodb` and all options on.

## Resolution

One pure function, `resolvePlan(manifest, request)`, returns

```ts
interface Plan {
  targets: string[];
  database: string;
  features: string[];
  options: string[];
  shared: string[];
  signInSite: 'full' | 'kept-for-native' | 'none';
  added: { id: string; because: string }[];
  errors: { id: string; reason: 'unknown' | 'planned' | 'conflict' | 'empty' }[];
}
```

Rules, each with a test:

1. At least one target. An empty list is an error.
2. A target marked `needsSignInSite` keeps the web sign-in pages even when `web` is not selected, and
   records it in `added`.
3. `requires` is expanded for targets, options and features, in manifest order, and each addition names
   what pulled it in.
4. A `planned` or unknown id is an error from flags or a file. It is never silently dropped.
5. Exactly one database.
6. A feature limited to some targets is removed when none of them is selected, and reported.
7. The result is deterministic: same request, same plan, same order.

## Pruning

- File globs per target, database, option and feature, as today.
- JSON files are edited by typed transforms, never by comment markers: root `package.json` workspaces,
  `app.json`, compose service lists. Each transform is a pure function with its own tests.
- The dangling-reference check learns workspace package imports, so a pruned `@app/*` package that is
  still imported fails the run.
- Dockerfiles copy the shared workspaces they need.

## Tests

- Unit: the resolver rules above, flag parsing, config file parsing and precedence, each JSON transform.
- Combination suite: every available target set times every available database, with `minimal` and
  `everything`, runs install, typecheck and build in the generated project. A combination that does not
  pass is not `available`.
- Packed install: the suite runs against `npm pack` output, not the workspace link.

## Delivery

| Step | Scope                                                                                                      | PR  |
| ---- | ---------------------------------------------------------------------------------------------------------- | --- |
| 1    | Manifest version 2, resolver, flags, config file, dry run, summary. Only `web` and `mongodb` are available | B   |
| 2    | Options pruning: docker, production, Arabic                                                                | B   |
| 3    | `native-expo` and `native-cli` become available with the shells                                            | G   |
| 4    | `postgres` becomes available with the adapter                                                              | H   |
