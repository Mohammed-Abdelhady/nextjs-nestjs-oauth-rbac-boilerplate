# Persistence notes

The server runs on MongoDB or on PostgreSQL. One setting chooses, and it is read once when the server starts. MongoDB is the default, so an installation that sets nothing runs exactly as it did before PostgreSQL existed.

PostgreSQL is not offered by the installer yet. Its adapter, migrations and tests are removed from generated projects, and so is this page.

## Choosing the database

| Setting             | Values                                     | Default        | Read when                     |
| ------------------- | ------------------------------------------ | -------------- | ----------------------------- |
| `DATABASE_TYPE`     | `mongodb`, `postgres`                      | `mongodb`      | Always                        |
| `MONGO_URI`         | A `mongodb://` or `mongodb+srv://` address | None, required | `DATABASE_TYPE` is `mongodb`  |
| `POSTGRES_URL`      | A `postgres://` or `postgresql://` address | None, required | `DATABASE_TYPE` is `postgres` |
| `POSTGRES_POOL_MAX` | 1 to 200 connections                       | `10`           | `DATABASE_TYPE` is `postgres` |

A PostgreSQL installation sets these, with its own values in place of the placeholders:

```
DATABASE_TYPE=postgres
POSTGRES_URL=postgres://APP_USER:APP_PASSWORD@DATABASE_HOST:5432/DATABASE_NAME
POSTGRES_POOL_MAX=10
```

The server refuses to start when the setting names an unknown database, or when the address of the chosen database is missing or malformed. The message names the setting. The address of the other database is not read at all.

Each module has one file named `*-persistence.ts` that hands it the chosen adapter. Nothing else in the server knows which database it is on. With MongoDB chosen, no PostgreSQL pool exists and no PostgreSQL job runs. With PostgreSQL chosen, no MongoDB connection is opened.

The server needs PostgreSQL 18 or newer, because new ids come from the `uuidv7()` function of the server.

## Running on PostgreSQL

### Migrations

The migrations are plain SQL files under `src/common/persistence/postgres/migrations`. An operator applies them. The server never does.

```
pnpm --filter backend run migration:postgres:up
pnpm --filter backend run migration:postgres:status
```

Both read the same environment the server reads. `up` applies what is pending, in order, each file in its own transaction, and says which files it applied. `status` changes nothing. Both exit with 1 when the database is not at this build afterwards, so a deploy script can test either.

`up` refuses a database that holds a migration this build does not carry. It names the files and applies nothing, because two builds that each carry a different next file must not both apply theirs.

Two people can run `up` at once. They take turns, and the second finds nothing left. The second waits at most two minutes for the first. After that it says another session holds the migration lock, applies nothing and exits with 1. That happens when the other run is still going, or when it was interrupted and its session is still connected.

The command needs a direct connection to PostgreSQL. The lock belongs to the database session, and a pooler in transaction mode gives each statement to another session, so the lock would protect nothing.

`0012_retention_indexes.sql` builds four indexes with plain `CREATE INDEX` inside its transaction. Writes to `sessions`, `authorization_transactions`, `native_credentials` and `native_dpop_proof_ids` wait until it commits. On a new database that takes no time. On a database that already holds many sessions, apply it with the server stopped.

When the server starts it compares the migrations it carries with the ones the database recorded. It refuses to serve when they differ and names the files.

### Expired rows

MongoDB removes expired rows with TTL indexes. PostgreSQL has none, so the server runs a retention job every five minutes. It removes rows past their expiry from the twelve tables MongoDB expires, at most 500 rows a statement and 20 statements a table in one run. What is left waits for the next run. A magic link is kept for an hour after it stops working, as on MongoDB, because the hourly request count reads it.

Each table is cleaned by itself. When the statement for one table fails, the job logs the table and goes on to the next.

No check of a code, a proof, a token or a session waits for this job. Each one compares the expiry itself, so an expired row the job has not reached yet is refused like one it has removed.

### Health

The health route answers from what the adapter last saw. On PostgreSQL the server asks the database once before it serves and then every five seconds. A look that gets no answer within three seconds counts as unreachable, and the next look starts on time.

The look has one connection of its own, apart from the application pool. A server whose application connections are all busy still reports a database that is up.

### Time bounds

These are fixed, not settings.

| Bound                                  | Value      | Why                                                                                                                      |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Waiting for a free connection          | 10 s       | A request that cannot get a connection in that time is refused instead of queued                                         |
| Statement, cancelled by the database   | 15 s       | Every statement is a keyed read or write or one retention batch and takes milliseconds. This only ends one that is stuck |
| Statement, given up on by the server   | 20 s       | Above the database's own bound, so it only fires when the database host has gone silent                                  |
| Keep-alive probe on an idle connection | after 10 s | A host that dropped off the network is noticed without waiting for the next statement                                    |
| One health look                        | 3 s        | Shorter than the five seconds between looks                                                                              |
| Stopping a schedule                    | 5 s        | Shutdown does not wait longer for a look or a retention statement in flight                                              |
| Closing a pool at shutdown             | 5 s        | The same, for a connection still held by a statement                                                                     |

The migration command has no statement bound, because building an index takes as long as the table is large.

### Stopping

Both schedules stop when the server shuts down. Retention ends its pass after the statement in flight. Each schedule waits at most five seconds for that statement, and each of the two pools waits at most five seconds to close, so a database host that has gone silent holds a shutdown for twenty seconds at the most.

## Tests

Every store has a contract suite that runs the same cases on both databases. The API suite runs on either one:

```
pnpm --filter backend run test:e2e
pnpm --filter backend run test:e2e:postgres
```

The PostgreSQL run starts one embedded server with a data folder of its own, gives each booted application a database copied from a migrated template, and removes all of it when the run ends.

## Differences between the databases

This part lists the places where the two databases are known to answer differently, so an operator who moves from one to the other knows what to expect. Each difference is a different order of the same requests, a different answer to a request that could not be completed, or a different form of the same value. None of them lets a session exist that should not.

### What an id looks like

An id on MongoDB is 24 hexadecimal digits. An id on PostgreSQL is a UUID version 7, 36 characters with hyphens. Each database refuses the other's form in a route with 400 and `Invalid identifier format`. Nothing in the server reads a time or an order out of an id.

A client that checks the form of an id has to accept the form of the database it talks to. Two cases of the SDK contract suite pin the MongoDB form and fail on PostgreSQL for this reason alone.

### The message for an id the database itself refuses

Routes check an id before it reaches a store, so this is rare. When a store does refuse one, both databases answer 400 with the code `INVALID_INPUT`. MongoDB's message is the driver's own sentence. PostgreSQL's is `Invalid input`. Only a value PostgreSQL was reading as an id is answered this way. Any other text it cannot read as its type is a fault and is answered 500.

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

The PostgreSQL adapter has to ask, and it remembers the answer. It tells three things apart: the server answers and takes writes, the server answers but is a standby or a session that may only read, and the server does not answer. The last two both show as unhealthy. Until the adapter has asked once, it reports the store as unreachable. The server asks once before it serves and then every five seconds, and gives up on a look after three, so an answer can be up to eight seconds old.

### What is checked when the server starts

On MongoDB the server builds every index its schemas declare, for every collection it uses, and takes requests only when all of them are in place. An index that is already there is left alone, and one that was dropped is built again. If an index cannot be built, for example because stored documents break a unique rule, the server does not start. Migrations are applied by an operator with `migrate-mongo`. The server has never read the record of applied migrations, so it starts on a database that is behind and does not say so.

A first start on an empty database builds every index and takes about a second. A later start only checks them, which takes a few milliseconds. A start after an upgrade that adds an index to a collection that already holds data waits for that index to be built, and the wait grows with the collection.

On PostgreSQL the indexes and unique rules are part of the migrations. The server compares the migrations it carries with the ones recorded in the database and refuses to start when they differ. The message names the migrations to apply, or the ones the database holds that this build does not carry. The server never applies a migration itself.

### How expired rows leave

MongoDB removes an expired row within about a minute of its expiry. PostgreSQL removes it at the next run of the retention job, up to five minutes later, and later still when a table holds more expired rows than one run takes. The row is refused from the moment it expires on both.
