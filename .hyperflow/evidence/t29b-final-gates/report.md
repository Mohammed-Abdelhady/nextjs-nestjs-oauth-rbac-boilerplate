# T29b final CLI gates

Run date: 2026-09-08

## Snapshot

- Source revision: `68cefb61f450b94c195a8d6cf325ac5e26c15349` on `feat/production-hardening`.
- Source implementation fingerprint: `04f6a4119adb6d58873bc5e0169829ee6bf6752cc8ef8ec9df57b707b3a1bf21`.
- Snapshot: `/private/var/folders/d1/tk4y3j012j57stv_sy0qpglr0000gn/T/t29b-final-gates-mJIC6h`.
- The copy excluded `.git`, all `.env` and `.env.*` files, and copied only the tracked `.env.docker.example`, `backend/.env.example`, and `frontend/.env.example` templates. Dependencies were copied into the snapshot. The final dependency copy retained relative `.bin` and workspace links so they resolve inside the snapshot.

## Gate results

`CI=1 NO_COLOR=1 npm test -w packages/create-nest-next-auth` exited 1. The CLI tests do not read `CI`, so the added variables only make output deterministic.

Vitest ran 96 tests in seven files. Eighty-six passed and ten failed. `test/e2e.test.ts` ran its packed-package setup and assertions, so the failed packed CLI build did not skip that suite.

The five `test/flags.test.ts` failures and the packed CLI failures have the same cause:

```
TypeError: (intermediate value).name(...).description(...).version(...).argument is not a function
```

Both the source and snapshot resolve `commander` to 4.1.1. The failure occurs at `packages/create-nest-next-auth/src/flags/options.ts:24`, where the CLI calls `.argument(...)`. The packed project was not generated, so its later file assertions report missing paths as follow-on failures.

The combinations gate and root production build were not run. The brief requires the package suite to pass before either gate.

## Logs and teardown

- `01-cli-package-suite.log` contains the full nonsecret test output.
- `01-cli-package-suite.status` records the exit code.
- `snapshot-capture.txt` records the copy fingerprint and allowed templates.

Teardown verification: the snapshot was removed and zero `cna-e2e-*` synthetic fixture directories remain. The npm command exited before teardown. Process enumeration is unavailable in this environment because `sysmond` is not available, so no independent process-list confirmation is possible.
