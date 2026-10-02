# Installer: mobile customization, project rules, existing projects

| Field   | Value                                                                         |
| ------- | ----------------------------------------------------------------------------- |
| Status  | v2, after debate. Ready for piece R1                                          |
| Date    | 2026-10-02                                                                    |
| Extends | `installer.md` (clients, database, options) and `mobile.md` (piece E4)        |
| Package | `packages/create-nest-next-auth`, manifest `template.manifest.json`           |
| Rule    | An option is offered only when the generated project passes its gates with it |

## TL;DR

Three additions asked for by the owner on 2026-10-02. A mobile app chosen at install (Expo or React
Native CLI) gets its own identity settings. Every generated project carries written rules for people
and agents, commit hooks and a continuous integration job, for backend, web and mobile. A second
command adds the rules to a project that already exists. The debate cut the first draft down: the rules
are split into policy and delivery, the scan gets a mode that checks committed content, `add` is
limited to layouts it can prove, and adding features to an old project is deferred.

## What ships today, measured

| Item                          | In a generated project today                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `.husky` hooks                | Copied. Never tested: the combination suite scaffolds with `--no-git` and installs with `--ignore-scripts` |
| `scripts/check-hard-bans.mjs` | Copied. Three gaps, below                                                                                  |
| `.lintstagedrc.cjs`           | Copied as is, names a package that is not there, and runs two fixers on the same file at once              |
| Root `AGENTS.md`              | None. Excluded by `sync-template.mjs`, and this repository has none                                        |
| Continuous integration        | None, here or in generated projects                                                                        |
| Mobile lint rules             | None, formatting only                                                                                      |

Scan gaps confirmed in the code: any file named `check-hard-bans.mjs` is exempt wherever it sits, the
push mode passes silently when it cannot work out a range, and there is no mode that scans committed
content, so a commit made with hooks skipped is never scanned.

## Part 1. Mobile identity settings

Asked only when a mobile target is chosen, once per chosen target, and always available as flags with
the target as prefix (`--expo-…`, `--cli-…`).

| Setting                | Meaning                                                    | Default                          |
| ---------------------- | ---------------------------------------------------------- | -------------------------------- |
| Display name           | What the user sees under the icon. Any text                | project folder name              |
| Native project name    | Identifier used by Xcode, the Podfile and app registration | derived, letters and digits only |
| Application id         | iOS bundle identifier and Android application id           | `com.example.<native name>`      |
| Sign-in return address | Full redirect address the server registers                 | derived from the application id  |

- The four are separate values even when one answer fills several. A display name is never used as an
  identifier.
- Validation runs before anything is written: reverse-domain application id, allowed scheme characters,
  no reserved schemes, and names that start with a digit, contain spaces or are not ASCII are
  normalised or refused with a message.
- The server example configuration and the app configuration are written from the same resolved value.
- Android: the application id is set, the Gradle namespace and source package are left as generated.
  The plan says so in the summary, because the two are different things.
- The bare app is produced from one pinned template stored in the installer, with a fixed list of
  replacements. Generation stays offline. Renaming an app after generation is not offered.
- Keeping only one platform in the bare app is dropped from the first release.
- A setting counts as supported only with a native build using a non-default value. A bundle does not
  prove identifiers compile or that the return address reaches the app.

## Part 2. Project rules

Policy and delivery are separate choices. Presets keep the prompt to one question.

| Choice             | Values               | Meaning                                                                                                                |
| ------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Policy             | `standard`, `strict` | `standard`: lint, typecheck, tests, commit format. `strict` adds the banned-construct scan and the file length ceiling |
| Agent instructions | on, off              | `AGENTS.md` at the root and per workspace present                                                                      |
| Hooks              | on, off              | pre-commit, commit-msg, pre-push                                                                                       |
| CI job             | on, off              | The same gate on every pull request                                                                                    |

Decided in the debate:

- One policy source: data (banned constructs, limits, rule text) and a dependency-free script in
  `scripts/guardrails/`, usable before any build. This repository's hooks use it directly. The
  installer copies the same files and renders the workspace-specific parts. A check fails when the
  rendered files and the source disagree.
- The scan gains a mode that takes a base and a head commit and fails when either is missing. Hooks and
  CI call the same entry point.
- lint-staged config is rendered from the workspaces that exist, with patterns that do not overlap, and
  the scan runs on what is finally staged.
- pre-push runs lint, typecheck and unit tests. Database-backed and native suites run in CI.
- Hook activation is reported as its own fact. With `--no-git` or `--no-install` the files are written
  and the summary says the hooks are not active, with the one command that activates them. The
  generated tree is validated before the scaffold's first commit.
- pnpm only, stated in the summary. The owner decided on 2026-10-02 that this repository and generated
  projects move from npm to pnpm (piece PM below). Other package managers are refused, not half supported.
- Hooks call locally installed tools and fail clearly when they are missing. Nothing is downloaded.
- Instructions guide, they do not enforce. The CI job produces a check, and blocking a merge still
  needs the repository owner to require that check. The generated rules file says both.

Tests, against the packed installer with real git and scripts enabled:

- Hooks are active after generation.
- A change that passes format, lint and typecheck but contains a banned construct is refused for that
  reason, and HEAD does not move. Removing it lets the commit through.
- The same content committed with hooks disabled is rejected by the CI entry point.
- commit-msg and pre-push are each exercised alone. Partial staging and file names with spaces.
- Under `standard` the banned construct is accepted, so the levels differ in a tested way.
- The workflow file is checked with actionlint and its command is the tested entry point. What GitHub
  itself does with it is reported as unverified until it runs there.

## Part 3. Existing projects

`create-nest-next-auth add rules`, for a documented set of layouts: a pnpm or npm project with a root
`package.json`, with or without npm workspaces. Anything else gets the instructions file only, labelled
inactive, or a refusal.

Safety contract:

- Nothing is installed or executed while inspecting or applying. No project config file is imported.
  Git is asked for status with its file monitor hook disabled.
- The exact content of every file and hook is shown before writing, and applied only on confirmation.
- Paths from the project are refused when absolute, escaping the root, or reached through a symbolic
  link. New files are created exclusively. Nothing from the project is put into a shell command.
- Existing hook setup, lint-staged config and `core.hooksPath` are detected first. The whole
  integration is checked before the first write: either all of it applies, or nothing is written and
  the tool prints the changes it would need. No half-configured result reported as success.
- The result lists four separate facts: files written, dependencies needed, hooks active, checks run.

Adding a mobile app or a sign-in method to a project made earlier is deferred. It is a migration, not a
copy: generation strips the markers needed to restore wiring, and the project has been edited since.
What is done now is the groundwork: generation writes `.create-nest-next-auth.json` before the first
commit, with a schema version, the template's identity, and the resolved answers, and no secrets.

## Pieces and order

| ID  | Piece                                                                                                                                                       | Owner    | After                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| R1  | Policy source in `scripts/guardrails/`, scan gaps closed, committed-range mode, used by this repository's hooks                                             | Sol      | nothing                                  |
| R2  | Root and workspace `AGENTS.md`, rendered lint-staged, hooks, for generated backend and web                                                                  | DeepSeek | R1, PM                                   |
| R3  | Hook activation reporting and the packed hook tests                                                                                                         | DeepSeek | R2                                       |
| R4  | CI workflow for this repository and for generated projects, same entry point                                                                                | MiMo     | R1                                       |
| R5  | Answers file written at generation                                                                                                                          | GLM      | nothing                                  |
| M   | Mobile identity settings and mobile rules, inside E4                                                                                                        | DeepSeek | E2, E3, F, native evidence               |
| A1  | `add rules` for the documented layouts                                                                                                                      | Sol      | R3                                       |
| PM  | Move this repository and generated projects from npm to pnpm: workspace file, lockfile, hooks, Dockerfiles, installer install step, combination suite, docs | Luna     | the lanes in flight on 2026-10-02 merged |

## Open, for the owner

- "App error" in the request is not settled. Typecheck in hooks and CI is planned. If it meant an error
  screen or error reporting inside the apps, that is a separate piece.
- Default policy for a stranger running the installer: `strict` as asked for this team, or `standard`
  with `strict` one answer away. The debate argued for `standard`.
- A project with no client at all (API only) was in the first draft and is removed. It needs its own
  decision because the installer requires at least one client today.

## What the debate changed

| Topic                 | Draft v1                                   | v2                                                        |
| --------------------- | ------------------------------------------ | --------------------------------------------------------- |
| Mobile settings       | App name, id, scheme, platforms            | Four separate identities, per target, no platform pruning |
| Rules shape           | One option, three levels                   | Policy and three delivery choices                         |
| Enforcement           | Hooks plus a CI job                        | One entry point with a committed-range mode, gaps closed  |
| Hook test             | Two commits                                | Packed install, real git, rejection reason asserted       |
| Existing project      | Any JavaScript repository, never overwrite | Documented layouts, all or nothing, safety contract       |
| Adding features later | Tier 2, re-resolve from answers            | Deferred. Only the answers file is written now            |
