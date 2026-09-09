This draft hardens the authentication template and adds disposable API/browser fixtures so generated projects and application journeys can be checked consistently. It covers auth-feature pruning, English/Arabic lifecycle and accessibility regressions, role pagination/filtering, current API contracts, and CI/Compose/nginx configuration.

Post-PR functional findings FR001–FR003 and GR001–GR007 have implementation fixes and passing local regressions. **Independent repair recheck and hosted CI rerun are pending.** The initial hosted run exposed combination-runner, browser-synchronization and Docker-health failures; local runner/browser gates now pass, while Docker runtime remains unverified.

Verified with Node 22.18.0: lint, types and production build; 708 backend, 123 frontend, 106 CLI and 18 configuration tests; 72 API cases; 116 browser cases; nine generated-combination assertions. The preceding fresh `npm ci` preserved the lockfile. All final browser cases ran without skips or retries. Generated projects retain product units and functional API tests; the browser harness is maintainer-only. Authenticated fixtures use actual per-case login after database resets.

**NOT READY for release:** security review is blocked, and CodeQL reports 31 untriaged alerts (30 high, 1 medium). No alert details were investigated. Docker/TLS runtime and live provider/mail/hardware behavior remain outside verified scope. No package publication, merge or deployment occurred.

See the [verification report](.hyperflow/reports/production-hardening.md) and [137-finding audit ledger](.hyperflow/reports/audit-status.md). The ledger preserves unresolved and blocked dispositions; it does not claim 137 findings closed.
