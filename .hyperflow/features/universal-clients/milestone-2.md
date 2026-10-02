# Milestone 2: shared code, mobile shells, installer targets

| Field     | Value                                                                                  |
| --------- | -------------------------------------------------------------------------------------- |
| Status    | First three pieces specified and dispatched. Mobile shells need their own spec         |
| Date      | 2026-10-02                                                                             |
| Base      | `staging` after milestone 1 (PRs #144 to #149, #158 to #161 merged)                    |
| Gate list | lint, typecheck, test, build, backend e2e, installer combinations. All six, every lane |

## TL;DR

Milestone 1 made native sign-in work on the server and in the browser. Milestone 2 gives the mobile app
something to be built from: one shared package for the rules and types both clients need, a way to
register a mobile app with the server, and installer options that really remove what was not chosen.

## Pieces in this file

| ID  | Piece                                                                                  | Owner    | Depends on |
| --- | -------------------------------------------------------------------------------------- | -------- | ---------- |
| D1  | `shared/core`: error codes, permissions, password rules, validators, API error parsing | Muse     | none       |
| N1  | Native applications declared in configuration and reconciled at start                  | Luna     | none       |
| B2  | Installer options that prune: Docker files, production files, Arabic                   | DeepSeek | none       |
| U1  | Three sign-in page defects found at phone width                                        | Muse     | D1         |

The mobile pieces have their own file, `mobile.md`.

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

## U1: sign-in page at phone width

Found on 2026-10-02 at 402 points wide, on the iPhone simulator and again in a desktop browser. All
three are in `master` too.

| Sev        | Defect                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Warning    | In light mode an unfocused field is filled with dark slate. The field uses the border colour token as its background         |
| Warning    | "Forgot password?" is positioned outside the form and the divider below overlaps it by 8 points                              |
| Suggestion | In development the page's content policy blocks `eval`, which React needs for its error overlay, so every page logs an error |

Each fix states its cause, measures the result in a browser in light and dark, in English and Arabic,
and at 320, 402 and 1280 wide. Field text and placeholder contrast is measured, not assumed.

Not done on the simulator: signing in and the mobile sign-in confirmation page. Another app held the
only simulator this run may use.

## A2: two more ways to tell a real address from an unknown one

Found by the reviewer of the forgot-password fix on 2026-10-02. Both are in `master`. Neither is fixed
by that change.

| Sev     | Defect                                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Warning | After register, resend or forgot-password, a wrong code answers "nothing pending" for an address with no record and "wrong code, N attempts left" for one with a record        |
| Warning | Two register or forgot-password requests at the same moment can answer 409 for one kind of address only, because the pending record is looked up and then created in two steps |

The first needs a design: an unknown address must appear to count attempts down too. The second is a
single atomic write. Owner: Luna, after S1.

## Debt seen, not scheduled

`as unknown as` appears in existing backend code and specs (one use in `auth.guard.ts`, the rest in
specs). The gate checks added lines only, so it passes. Removing them is its own piece.

## Later pieces, not specified here

`shared/sdk` (typed API client with injected transport), message catalogues in a shared package, the
device key module, the Expo and bare shells, device-bound tokens, target-aware installer, backend
adoption of `@app/core`, persistence ports, PostgreSQL.
