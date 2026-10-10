# Persistence notes

The server stores its data in MongoDB. A PostgreSQL adapter is being built behind the same storage ports as a prototype. It lives under `backend/test/postgres-prototype`, it is not offered to generated projects, and nothing in production uses it yet.

Every store has a contract suite that runs the same cases on both databases. This page lists the places where the two databases are known to answer differently, so an operator who moves from one to the other knows what to expect.

## Differences between the databases

Each difference below is a different order of the same requests, or a different answer to a request that could not be completed. None of them lets a session exist that should not.

### A replayed refresh token during a rotation

A refresh token that was already used is a replay, and a replay ends the whole token family.

On MongoDB a replay that arrives while a rotation of the same family is still running ends the family, and the rotation then fails.

On PostgreSQL the rotation holds the family until it finishes. The replay cannot get in, it is refused three times, and the caller gets a 503 with the family still alive. The rotation succeeds. A replay sent again afterwards ends the family, as it does on MongoDB.

This was reviewed and accepted as it is. A rotation takes less time than the pause before a rerun, so in practice the rerun gets in and the family ends. If you see a 503 on the token route together with a later `refresh_replayed` revocation for the same session, this is what happened.

### A stale primary after a failover

A fresh authority read on MongoDB is a linearizable read. A primary that has lost its majority cannot answer it, so a session ended on the new primary is never accepted by the old one.

A fresh read on PostgreSQL is one statement sent to the server the application believes is the primary. PostgreSQL does not notice by itself that it has been replaced. The hosting setup must fence the old primary during a failover, so that it stops accepting connections before the new one starts taking writes.

### A lost answer to a commit

When the answer to a commit is lost, the server does not know whether the work was stored.

If the commit had landed, neither database runs the work again.

If the commit had not landed, MongoDB runs the work once. PostgreSQL asks the server whether the transaction committed, learns that it did not, and runs the work again from the start. The stored result is the same on both.

### Blocking a grant for an account that does not exist

MongoDB stores the blocked grant, because nothing ties a grant to an existing account.

PostgreSQL refuses it, because a grant refers to its account by a foreign key.

No request can reach this today. The account id always comes from a signed-in person or from an admin screen that lists existing accounts.

### A mobile sign-in that overlaps switching its application off

Switching an application off advances its version, and every session issued for the older version stops validating.

A code exchange that had already read the application as enabled finishes on both databases. The session it stores carries the older version, so it never validates, and switching the application back on does not revive it.

A code exchange that had started but had not yet read the application sees different things. PostgreSQL reads what is committed at each statement, sees the application switched off, and refuses the exchange. MongoDB reads what was committed when the unit of work began, so it still sees the application enabled and stores a session that is already ended. On both, the authorization code is spent and no usable session exists.

### Where the second of two requests is refused

When two requests change the same account, token family or authorization code at once, both databases let one through and make the other run again.

MongoDB refuses the second request at its first write. PostgreSQL refuses it earlier, at its first read, with a row lock that does not wait. The answers the two callers get are the same.

### What the health check can tell

The health route asks the adapter what it last saw of the store. It does not wait on the database, so it answers at once on both.

The MongoDB driver keeps its own view of the connection. The adapter takes a connected driver as ready, and it cannot tell a member that refuses writes from one that takes them. The connection is opened for the primary with majority writes, so in practice there is no other member to be connected to.

The PostgreSQL adapter has to ask, and it remembers the answer. It tells three things apart: the server answers and takes writes, the server answers but is a standby or a session that may only read, and the server does not answer. The last two both show as unhealthy. Until the adapter has asked once, it reports the store as unreachable. Something has to call its `observe` on a schedule once the adapter is wired into the application.

### What is checked when the server starts

On MongoDB the server builds the indexes its schemas declare and then starts. Migrations are applied by an operator with `migrate-mongo`. The server has never read the record of applied migrations, so it starts on a database that is behind and does not say so.

On PostgreSQL the indexes and unique rules are part of the migrations. The server compares the migrations it carries with the ones recorded in the database and refuses to start when they differ. The message names the migrations to apply, or the ones the database holds that this build does not carry. The server never applies a migration itself.
