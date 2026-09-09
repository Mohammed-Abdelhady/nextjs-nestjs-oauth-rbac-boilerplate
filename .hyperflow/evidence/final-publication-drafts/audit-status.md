# Audit status

Draft — **NOT READY for release**. Status recorded on 2026-09-08. This pre-push record includes accepted bounded independent rechecks of the functional repairs and the five-path browser/HTTP-contract repair. Subsequent 320px sessions wrapping and dialog focus repairs pass local checks, including 78/78 authenticated browser cases, and await independent recheck. New hosted confirmation remains pending.

This ledger preserves all 137 finding IDs, titles, task mappings and dispositions from the 2026-09-03 audit inventory. It records review status, not 137 resolved findings. Historical implementation records do not establish independent closure. Current local verification and release limits are in [Production hardening](production-hardening.md).

| Disposition                        | Findings | Meaning                                                                                                                     |
| ---------------------------------- | -------: | --------------------------------------------------------------------------------------------------------------------------- |
| blocked by existing review control |       22 | Security review is blocked; no closure is claimed.                                                                          |
| needs independent re-review        |      102 | Historical work or test evidence exists, but exact independent closure is pending.                                          |
| unmapped needs evidence            |       10 | No exact task mapping or sufficient disposition evidence is established.                                                    |
| verified within named test scope   |        3 | The existing T21 selector, fixture and browser synchronization coverage passed; independent audit closure is still pending. |

The CodeQL PR summary for revision `954b99a319d171d8dd488372fda6f4f530440dce`, observed on 2026-09-08, reported **31 untriaged alerts: 30 high and 1 medium**. This is a reported count, not a validated finding inventory. No alert details were investigated. These alerts and the separate post-PR functional findings do not change the 137-row ledger below.

The security rows remain blocked. Later fixes to persistence, navigation, localization and accessibility do not automatically close similarly named historical findings. Operational finding T30-OP-001 and generated-template finding T30-CLI-002 are separate from these 137 rows; their narrower status is recorded in the production report. The subsequent FR001–FR003, GR001–GR007, CI-COMB-01 and HFR001/HFR002 repairs passed local verification and bounded independent recheck. The browser layout and SSR probe changes passed scoped independent recheck; hosted confirmation is pending. Subsequent 320px sessions wrapping and dialog focus repairs await independent recheck and new hosted evidence. No historical row is closed by association with those repairs.

| ID   | Audit title                                             | Task     | Disposition                        |
| ---- | ------------------------------------------------------- | -------- | ---------------------------------- |
| S-01 | Deleted-user checks absent                              | T01      | blocked by existing review control |
| S-02 | Production Mongo exposure and default password          | T02      | blocked by existing review control |
| S-03 | Peer-manager mutation allowed                           | T08      | blocked by existing review control |
| S-04 | OAuth state not persisted or compared                   | T11      | blocked by existing review control |
| S-05 | Proxy throttling and login limit gap                    | T05      | blocked by existing review control |
| S-06 | Plaintext session tokens and logging                    | T05      | blocked by existing review control |
| S-07 | Password reset leaves sessions valid                    | T01      | blocked by existing review control |
| S-08 | Environment validation inactive                         | T06      | blocked by existing review control |
| S-09 | Pending registration can be overwritten                 | T09      | blocked by existing review control |
| S-10 | HTML mail name is unescaped                             | T09      | blocked by existing review control |
| S-11 | Unbounded regular-expression input                      | T07      | blocked by existing review control |
| S-12 | Provider login replaces email                           | T11      | blocked by existing review control |
| S-13 | Error responses reveal account state                    | T09      | blocked by existing review control |
| S-14 | Seed administrator credentials hardcoded                | T10      | blocked by existing review control |
| S-15 | System-role protection incomplete                       | T08      | blocked by existing review control |
| S-16 | Nginx headers and CSP gap                               | T03      | blocked by existing review control |
| S-17 | Provider secret sent in query                           | T11      | blocked by existing review control |
| S-18 | Direct permission grants accept arbitrary strings       | T08      | blocked by existing review control |
| S-19 | Authentication persisted too broadly                    | T19      | blocked by existing review control |
| S-20 | Next.js security headers absent                         | T20      | blocked by existing review control |
| S-21 | Verification guard and public decorator unused          | T13      | blocked by existing review control |
| S-22 | Health endpoint discloses operational data              | T13      | blocked by existing review control |
| D-01 | Role rename leaves user roles stale                     | T08      | needs independent re-review        |
| D-02 | Cross-reference to S-01                                 | unmapped | unmapped needs evidence            |
| D-03 | Cross-reference to S-12                                 | unmapped | unmapped needs evidence            |
| D-04 | OAuth-only password comparison throws                   | T01      | needs independent re-review        |
| D-05 | Login-attempt increment race                            | T01      | needs independent re-review        |
| D-06 | Boolean transform misreads false                        | T07      | needs independent re-review        |
| D-07 | Identifier and duplicate errors return 500              | T07      | needs independent re-review        |
| D-08 | Migration index ownership conflicts                     | T10      | needs independent re-review        |
| D-09 | Duplicate migration systems                             | T10      | needs independent re-review        |
| D-10 | Database reset deletes migration changelog              | T10      | needs independent re-review        |
| D-11 | Production seed guard fails open                        | T10      | needs independent re-review        |
| D-12 | Linked-provider defaults diverge                        | T09      | needs independent re-review        |
| D-13 | Cross-reference to S-11                                 | unmapped | unmapped needs evidence            |
| D-14 | Cross-reference to S-06                                 | unmapped | unmapped needs evidence            |
| D-15 | Session request path writes on every request            | T05      | needs independent re-review        |
| D-16 | Custom roles cannot be selected                         | T08      | needs independent re-review        |
| D-17 | Two root Mongo connections                              | T10      | needs independent re-review        |
| D-18 | Unused token fields                                     | T10      | needs independent re-review        |
| D-19 | Unused device fields and index                          | T10      | needs independent re-review        |
| D-20 | Unused permissions collection                           | T10      | needs independent re-review        |
| D-21 | Admin-user mapping omits provider fields                | unmapped | unmapped needs evidence            |
| D-22 | Role pagination shape differs from frontend             | unmapped | unmapped needs evidence            |
| D-23 | Provider enum differs from values                       | unmapped | unmapped needs evidence            |
| D-24 | Deprecated migration driver options                     | T10      | needs independent re-review        |
| D-25 | Unsupported Mongoose nullable option                    | T10      | needs independent re-review        |
| D-26 | Inconsistent migration filename separator               | T10      | needs independent re-review        |
| D-27 | Default role permissions duplicated                     | T10      | needs independent re-review        |
| D-28 | Effective-permission logic repeated                     | T08      | needs independent re-review        |
| D-29 | Cookie configuration reads process environment directly | T05      | needs independent re-review        |
| D-30 | Obsolete Mongoose type package                          | T10      | needs independent re-review        |
| A01  | Open redirect query                                     | T04      | needs independent re-review        |
| A02  | Locale navigation active state                          | T04      | needs independent re-review        |
| A03  | Form handler and ARIA spread order                      | T14      | needs independent re-review        |
| A04  | Resend cooldown disables submit                         | unmapped | unmapped needs evidence            |
| A05  | Form labels target wrapper elements                     | T14      | needs independent re-review        |
| A06  | Placeholder-only form labels                            | T14      | needs independent re-review        |
| A07  | Keyboard focus misses hover actions                     | T15      | needs independent re-review        |
| A08  | No valid focus-ring utility                             | T15      | needs independent re-review        |
| A09  | Logout icon has no accessible name                      | T15      | needs independent re-review        |
| A10  | Password toggle is not operable                         | T14      | needs independent re-review        |
| A11  | Mobile drawer lacks dialog behavior                     | T15      | needs independent re-review        |
| A12  | RTL direction support absent                            | T17      | needs independent re-review        |
| A13  | Users page lacks permission guard                       | T04      | needs independent re-review        |
| A14  | Hardcoded and orphaned translations                     | T18      | needs independent re-review        |
| A15  | Arabic plural categories incomplete                     | T18      | needs independent re-review        |
| A16  | Arabic validation messages remain English               | T18      | needs independent re-review        |
| A17  | Loading states render blank screens                     | T15      | needs independent re-review        |
| A18  | Navigation redirects to locale                          | T04      | needs independent re-review        |
| A19  | Muted text contrast too low                             | T16      | needs independent re-review        |
| A20  | Status-color contrast too low                           | T16      | needs independent re-review        |
| A21  | Motion runs on data updates                             | T16      | needs independent re-review        |
| A22  | Static banners use alert role                           | T15      | needs independent re-review        |
| A23  | Nested main landmarks                                   | T15      | needs independent re-review        |
| A24  | Heading hierarchy and skip link                         | T15      | needs independent re-review        |
| A25  | Expand controls lack state                              | T15      | needs independent re-review        |
| A26  | Busy buttons lose names                                 | T15      | needs independent re-review        |
| A27  | Accessible labels untranslated                          | T15      | needs independent re-review        |
| A28  | Targets too small                                       | T15      | needs independent re-review        |
| A29  | Tabs overflow                                           | T19      | needs independent re-review        |
| A30  | Pagination lacks loading behavior                       | T19      | needs independent re-review        |
| A31  | Tooltip is hover-only                                   | T19      | needs independent re-review        |
| A32  | Password checklist absent                               | T14      | needs independent re-review        |
| A33  | Duplicate callback pages redirect on timer              | T12      | needs independent re-review        |
| A34  | Dead links and default page title                       | T18      | needs independent re-review        |
| A35  | Local storage read during state initialization          | T19      | needs independent re-review        |
| A36  | Header overlap                                          | T17      | needs independent re-review        |
| A37  | Generated IDs collide                                   | T15      | needs independent re-review        |
| A38  | Validation errors are toast-only                        | T15      | needs independent re-review        |
| A39  | Date and number formatters fixed to en-US               | T18      | needs independent re-review        |
| A40  | System theme ignored                                    | T16      | needs independent re-review        |
| A41  | No separate title in grouped audit row                  | unmapped | unmapped needs evidence            |
| C01  | Files exceed size limit                                 | T19      | needs independent re-review        |
| C02  | Dead frontend code                                      | T19      | needs independent re-review        |
| C03  | Multiple toast entry points                             | T19      | needs independent re-review        |
| C04  | API-error helper not consistently used                  | T14      | needs independent re-review        |
| C05  | Root-error and submit markup duplicated                 | T14      | needs independent re-review        |
| C06  | Client-component overuse                                | T19      | needs independent re-review        |
| C07  | Interactive elements lack test IDs                      | T19      | needs independent re-review        |
| T01  | Stale selectors                                         | T21      | verified within named test scope   |
| T02  | Missing auth fixture and locale support                 | T21      | verified within named test scope   |
| T03  | Brittle browser selectors and waits                     | T21      | verified within named test scope   |
| T04  | Unit test file has no runner                            | T00      | needs independent re-review        |
| T05  | Browser coverage lacks accessibility, RTL, and flows    | T21      | needs independent re-review        |
| X-01 | Workspace lockfiles break Docker build                  | T03      | needs independent re-review        |
| X-02 | Health probe uses wrong prefixed route                  | T03      | needs independent re-review        |
| X-03 | Compose port and environment mismatch                   | T02      | needs independent re-review        |
| X-04 | Public API URL inlined at build                         | T03      | needs independent re-review        |
| X-05 | Configuration validation is not wired                   | T06      | needs independent re-review        |
| X-06 | OAuth response shape differs from reducer               | T11      | needs independent re-review        |
| X-07 | OAuth documentation has wrong callback details          | T23      | needs independent re-review        |
| X-08 | Root scripts cannot run                                 | T00      | needs independent re-review        |
| X-09 | API collection does not match cookie API                | T23      | needs independent re-review        |
| X-10 | Duplicate root Mongo connections                        | unmapped | unmapped needs evidence            |
| X-11 | Health endpoint always responds 200                     | T13      | needs independent re-review        |
| X-12 | Controller reaches through service internals            | T11      | needs independent re-review        |
| X-13 | Session cookie configuration duplicated                 | T05      | needs independent re-review        |
| X-14 | Duplicate endpoint injection collisions                 | T12      | needs independent re-review        |
| X-15 | Refresh endpoint does not exist                         | T12      | needs independent re-review        |
| X-16 | Provider definitions are hardcoded repeatedly           | T11      | needs independent re-review        |
| X-17 | Provider enum does not match actual values              | T11      | needs independent re-review        |
| X-18 | Environment variables missing from schema               | T06      | needs independent re-review        |
| X-19 | Raw console logging                                     | T13      | needs independent re-review        |
| X-20 | Root next-intl dependency is spurious                   | T20      | needs independent re-review        |
| X-21 | Lodash dependency remains stale                         | T20      | needs independent re-review        |
| X-22 | Engine and eslint dependency mismatch                   | T00      | needs independent re-review        |
| X-23 | CI and Dependabot absent                                | T22      | needs independent re-review        |
| X-24 | Production setup does not generate or protect secrets   | T02      | needs independent re-review        |
| X-25 | Initialization script overwrites configuration          | T23      | needs independent re-review        |
| X-26 | OAuth state helpers duplicated                          | T11      | needs independent re-review        |
| X-27 | Backend files exceed size limit                         | T06, T13 | needs independent re-review        |
| X-28 | Backend coverage gaps                                   | T13      | needs independent re-review        |
| X-29 | Error codes derive from message text                    | T07      | needs independent re-review        |
| X-30 | Client navigation omits locale                          | T04      | needs independent re-review        |
| X-31 | Provider values cast from server strings                | T12      | needs independent re-review        |
| X-32 | Tracked and stale project documentation                 | T23      | needs independent re-review        |
