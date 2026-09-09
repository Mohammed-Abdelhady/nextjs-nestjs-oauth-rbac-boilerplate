## Summary

Complete configurable authentication scaffolding and the local verification needed to maintain it. The generated projects preserve selected authentication methods and usable API/unit tests; the source repository retains the full browser harness.

- Repair localized sign-in, account persistence, return destinations, network messages, document direction, accessible labels/contrast, and bodyless deletion handling.
- Add disposable database, mail and local-provider fixtures with actual account/session journeys and representative English/Arabic desktop/mobile coverage.
- Add CI integration commands, filtered Docker verification tooling and two curated reports containing the final results and all 137 historical audit dispositions.

## Validation

Node 22.18.0 / npm 10.9.3: fresh install with unchanged lockfile; root lint, types, tests and production build pass. Backend units 708/708, frontend units 123/123, packed CLI tests 99/99, generated combinations 9/9, backend API tests 72/72 and browser cases 112/112. Browser runs had zero retries/skips; 16 representative axe captures reported no WCAG A/AA violations. `npm pack` and `npm publish --dry-run` pass; nothing was published.

Candidate commit hooks run normally, and the actual pre-push hook runs lint, types and tests. API/browser evidence is reused from the identical application and fixture sources on the same supported runtime; the candidate also reruns its root gates and generated-package checks.

## Draft limits

This PR is **not ready for release**. Independent post-PR review remains pending, and the separate security review is blocked by an existing control rejection. The audit ledger does not claim all 137 findings are closed. Docker socket/helper-listener permissions prevented live runtime verification; production TLS remains unverified. Local provider/mail fixtures establish application integration, not external provider conformance, actual mail delivery or hardware behavior. Hosted CI results remain pending.

Authenticated cases use fresh real sign-in after each reset rather than reused storage state. The full browser harness is maintainer-only; generated projects retain functional backend API and product unit tests.

## Checklist

- [x] All quality gates pass (`npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`).
- [x] Documentation updated for changed behavior and configuration.
- [x] Migration scripts included for database schema changes; production execution remains unverified.
- [x] User interface changes verified in a browser in both LTR and RTL directions.
