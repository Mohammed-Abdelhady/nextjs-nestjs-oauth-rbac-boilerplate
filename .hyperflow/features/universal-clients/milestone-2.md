# Milestone 2: shared code, mobile shells, installer targets

| Field     | Value                                                                        |
| --------- | ---------------------------------------------------------------------------- |
| Status    | First three pieces specified and dispatched. Mobile shells need their own spec |
| Date      | 2026-10-02                                                                   |
| Base      | `staging` after milestone 1 (PRs #144 to #149, #158 to #161 merged)          |
| Gate list | lint, typecheck, test, build, backend e2e, installer combinations. All six, every lane |

## TL;DR

Milestone 1 made native sign-in work on the server and in the browser. Milestone 2 gives the mobile app
something to be built from: one shared package for the rules and types both clients need, a way to
register a mobile app with the server, and installer options that really remove what was not chosen.

## Pieces in this file

| ID  | Piece                                                         | Owner    | Depends on |
| --- | ------------------------------------------------------------- | -------- | ---------- |
| D1  | `shared/core`: error codes, permissions, password rules, validators, API error parsing | Muse     | none       |
| N1  | Native applications declared in configuration and reconciled at start | Luna     | none       |
| B2  | Installer options that prune: Docker files, production files, Arabic | DeepSeek | none       |

## D1: `shared/core`

Package `@app/core` in a new top-level workspace `shared/core`. Platform-neutral: no DOM, no React, no
Next, no React Native, no Node built-ins.

- Moves from the web app: `constants/errorCodes.ts`, the permission constants and helpers, password
  rules, the validator factories except the file validators (they need `File`), and the API error
  parsing helpers.
- The web app imports them from `@app/core`. No copy is left behind and no re-export shim.
- The package ships TypeScript source. The web app lists it in `transpilePackages`. No build step.
- Root `package.json` workspaces gain `shared/*`. The web Dockerfile copies the workspace it now needs.
- A drift test compares the backend's error codes and permission strings with the shared ones by value,
  until the backend consumes the package itself (a later piece).
- Feature pruning: any shared file or line that belongs to an optional feature carries that feature's
  marker or manifest glob, and the installer's dangling-import check must understand `@app/core`
  imports.

Out of scope for D1: message catalogues, the API client (`shared/sdk`), and backend adoption.

## N1: native applications from configuration

Today nothing creates a native application record. The real-environment run inserted one by hand.

- A list of native applications is read from configuration (one environment variable holding JSON, with
  an example in the env example files): client id, display name, redirect addresses, allowed scopes.
- At start, in every environment, the list is validated and reconciled into the applications
  collection for the current environment: created, updated, and disabled when removed from the list.
  Nothing is deleted.
- Every redirect address passes the existing redirect address validator. A bad entry stops the start
  with a message that names the entry and the reason.
- Reconciling is idempotent and safe with several instances starting at once.
- With mobile sign-in turned off, the list is ignored and nothing is written.

## B2: installer options that prune

`docker`, `production` and `locale-ar` are `planned` in the manifest. This piece makes them real.

- Each option lists its files. Turning one off removes them and every reference to them: compose
  commands in the printed next steps, scripts in `package.json`, docs sections, and for Arabic the
  catalogues, the locale list, and the right-to-left check.
- JSON files are edited by typed transforms with their own tests, never by comment markers.
- `production` requires `docker`. The resolver already reports that conflict.
- A generated project with any mix of the three options installs, typechecks and builds. The
  combinations suite gains those cases.
- Only when all of that passes do the three options lose `planned`.

## Later pieces, not specified here

`shared/sdk` (typed API client with injected transport), message catalogues in a shared package, the
device key module, the Expo and bare shells, device-bound tokens, target-aware installer, backend
adoption of `@app/core`, persistence ports, PostgreSQL.
