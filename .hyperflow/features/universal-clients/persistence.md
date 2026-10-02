# Database choice: MongoDB or PostgreSQL

| Field    | Value                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Status   | v2, after debate. Nine positions changed, listed under "What the debate changed"                              |
| Date     | 2026-10-02                                                                                                    |
| Based on | A read of every database touchpoint in `backend/` at `b202dcb`, and a review of the session code's guarantees |

## TL;DR

The installer should let a person choose MongoDB or PostgreSQL. Today the server has no seam for that:
43 files inject a Mongoose model directly. This plan does three things in order. First it writes the
race tests the session code does not have yet, on MongoDB, because they are needed whichever database
runs. Then it proves the seam on the hardest case, on both databases at once, before converting
anything else. Only then does it convert the rest, module by module. PostgreSQL is offered by the
installer when the whole server test suite passes on it, not before.

## What exists today

| Fact                                           | Number or place                             |
| ---------------------------------------------- | ------------------------------------------- |
| Schema files, collections                      | 17, 16                                      |
| Files that inject a model or the connection    | 43, about 7,800 lines                       |
| Repository classes or persistence interfaces   | None                                        |
| Transactions                                   | 9 call sites, all under `session/`          |
| Reads that must see the latest committed write | 10 call sites, all under `session/`         |
| Collections that expire rows by a TTL index    | 10                                          |
| Embedded documents and arrays of objects       | Users: linked accounts, two-factor          |
| Tests that need a real MongoDB                 | 29 files                                    |
| Test replica set                               | One member, so nothing tests failover today |

## Guarantees the session code makes, and what holds them up

Each must hold on both databases. The last column is what protects it today.

| Guarantee                                                                                               | Rests on today                                    | Test today      |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------- |
| Two sign-ins at the last free session slot admit one                                                    | A write to the user's issuance counter conflicts  | Yes             |
| A validation sees a revocation that has completed                                                       | Linearizable reads on the primary                 | Sequential only |
| "Sign out everywhere else" keeps exactly one eligible session                                           | A guarded counter update in one transaction       | Yes             |
| Approve and deny have one winner                                                                        | A guarded update                                  | Yes             |
| A code is exchanged once. A full session cap leaves the code usable, a failed authority check spends it | One transaction, two deliberate outcomes          | Yes             |
| A refresh token is spent once and its successor is stored with it                                       | One transaction                                   | Sequential only |
| A replayed refresh token ends the family, though the answer is a failure                                | The revocation commits before the failure returns | Sequential only |
| Extending an idle session cannot revive a revoked one                                                   | One guarded update                                | No race test    |
| A browser proof is used once                                                                            | A guarded update                                  | No race test    |
| A state change and its security event commit together                                                   | The event shares the transaction                  | No failure test |
| A commit whose answer was lost is never run again                                                       | The helper separates commit retry from rerun      | Mocked only     |

## Decisions

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | Stores named for what a service needs (`reserveRegistrationAttempt`, `claimUnapprovedAuthorization`), not one repository per collection. No query language crosses the seam. Authorization rules stay in services                                                                                                                                                                                            |
| P2  | Ids are opaque strings at the seam. MongoDB ids and cookies already issued keep their exact form. PostgreSQL uses UUID version 7 for new installs. Every id check moves behind the adapter: route pipes, the two-factor cookie decoder, service validators, fixtures. No code may read time or order out of an id                                                                                            |
| P3  | A unit of work port replaces the transaction helper. A store method that takes part in an atomic workflow REQUIRES a unit of work in its signature. It is not optional, so a method cannot quietly commit on its own. The port defines who owns the transaction, that a normal return commits and a throw rolls back, which failures rerun the whole work, and that an unknown commit outcome is never rerun |
| P4  | Two kinds of read, named apart: a committed authority read (fresh, from the primary, outside any older snapshot) and a read inside a unit of work. PostgreSQL uses read committed with an explicit per-user lock taken before versions are read and sessions are counted, shared by browser and mobile issuance. Not serializable isolation                                                                  |
| P5  | Expiry is decided per operation, not by one rule. Authentication checks compare the expiry time themselves and never trust cleanup. Counting for a rate limit may include expired rows on purpose. How long a row is kept is a separate setting from when it stops being valid                                                                                                                               |
| P6  | Each guarded write returns an outcome made for that operation (claimed, already claimed, expired, not found), not a row count. PostgreSQL counts a matched row as updated even when nothing changed, so counts cannot carry the meaning                                                                                                                                                                      |
| P7  | Adapter errors map to a shared set: unique conflict with the name of the constraint, malformed id, retryable abort, timeout, unavailable, unknown outcome. The global filter stops reading driver error shapes                                                                                                                                                                                               |
| P8  | PostgreSQL through a typed query builder (Kysely on `pg`) with plain SQL migrations, kept inside the adapter. Embedded user data becomes child tables with the same uniqueness rules. Proven first by a prototype that covers transaction ownership, guarded updates, bytes, dates and nullable columns                                                                                                      |
| P9  | Three layers of test run on both databases: a contract suite per store, service scenarios for every workflow that spans stores (with failures injected between writes), and the whole server API suite. PostgreSQL is offered only when all three pass                                                                                                                                                       |
| P10 | PostgreSQL in tests comes from a development dependency that carries its own server, named and pinned in the first piece after proving it on this machine's architecture, with isolated data folders and cleanup. A single server proves nothing about failover, and the plan says so                                                                                                                        |
| P11 | Durability is stated, not assumed. MongoDB installs keep majority writes. A PostgreSQL install is documented as one primary with synchronous commit. Replication is the operator's choice and asynchronous replicas are described as weaker than the MongoDB default                                                                                                                                         |
| P12 | The installer's database choice removes the other adapter, its migrations, its dependencies and lockfile entries, its compose service and every reference to it, its environment variables and their validation, and the setup scripts' database steps. A project generated with either choice installs from a clean folder, without borrowing this repository's dependencies, and passes the server suite   |

## Order of work

| Step | Piece                                                                                                                                                                                                                                                                                                                                                         | Size   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0    | The missing race tests, on MongoDB: two refreshes at once, replay against rotation, extension against revoke, two uses of one browser proof, a security event that fails to insert, sign-in against "revoke all". Barriers that do not reach into Mongoose                                                                                                    | Medium |
| 1    | Proof of the seam on the hardest case: browser sign-in at the last session slot (user lock, grant, count, session, event) behind a store and unit of work, on MongoDB and on a PostgreSQL prototype together. Two concurrent sign-ins admit one, and a failed event leaves no session. If SQL locks or driver objects leak into the service, stop and rethink | Medium |
| 2    | Seam basics for everything else: ids, error types, the contract-suite harness                                                                                                                                                                                                                                                                                 | Medium |
| 3    | Roles                                                                                                                                                                                                                                                                                                                                                         | Small  |
| 4    | Pending codes: registration, password reset, magic link. Attempt reservation and generation checks are not simple reads and writes                                                                                                                                                                                                                            | Medium |
| 5    | Users with linked accounts and two-factor, passkeys and their challenges                                                                                                                                                                                                                                                                                      | Medium |
| 6    | Browser proofs, security events                                                                                                                                                                                                                                                                                                                               | Small  |
| 7a   | Session authority: browser issuance and committed authority reads (finishes what step 1 started)                                                                                                                                                                                                                                                              | Medium |
| 7b   | Revocation, targeted and bulk, and keeping the survivor                                                                                                                                                                                                                                                                                                       | Medium |
| 7c   | Applications and grants, and reconciliation at start                                                                                                                                                                                                                                                                                                          | Medium |
| 7d   | Approve, deny and code exchange                                                                                                                                                                                                                                                                                                                               | Medium |
| 7e   | Refresh rotation, replay and ending a family                                                                                                                                                                                                                                                                                                                  | Medium |
| 8    | Health, seed and reset, index and migration ownership at start                                                                                                                                                                                                                                                                                                | Medium |
| 9    | The rest of the PostgreSQL adapter, store by store, with migrations                                                                                                                                                                                                                                                                                           | Large  |
| 10   | Installer: the choice, pruning, clean installs, combinations for both databases                                                                                                                                                                                                                                                                               | Large  |

Steps 2 to 8 change no behaviour, with one stated exception: where a read trusted cleanup timing, it now
checks expiry itself. After step 8 no file outside the MongoDB adapter imports Mongoose, checked by a
lint rule.

## When to stop

- Step 1 shows that locks, isolation levels or driver objects must appear in a service.
- Nobody owns both databases' race tests, migrations and release gates.
- A generated project cannot install and start without this repository's dependencies.
- The behaviour of the two databases is going to differ on purpose. Then PostgreSQL is a second template
  with the same guarantees, not a choice in this one.

## What the debate changed

| Topic             | Draft v1                                 | v2                                                                          |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Isolation         | Serializable with retry                  | Read committed with an explicit per-user lock                               |
| Unit of work      | Optional argument                        | Required by the signature of every method in an atomic workflow             |
| Fresh reads       | "On the primary inside the unit of work" | A separate committed read, never from an older snapshot                     |
| Expiry            | Every read filters expired rows          | Decided per operation. Validity and retention are separate                  |
| Write results     | Applied or not                           | An outcome per operation                                                    |
| Errors            | Two shared types                         | Six, with constraint identity                                               |
| Acceptance        | Store suites                             | Store suites, service scenarios with injected failures, the whole API suite |
| Order             | PostgreSQL after all MongoDB extraction  | Missing race tests first, then one hard case on both databases              |
| Session authority | One step                                 | Five                                                                        |

## Most likely failure

Transaction ownership gets lost during extraction. Every store passes on its own, and one method opens
its own transaction. Then a replayed refresh token is answered as a failure while the family's
revocation rolls back, and the successor stays usable. P3 and the service scenarios in P9 exist for
this.

## Open, for the owner

This is the largest piece of the program: fifteen steps, and it keeps two databases alive for good.
Step 0 is worth doing whatever is decided, since those races are untested today on the only database
there is. Step 1 is the cheapest honest way to learn whether the rest is worth it.
