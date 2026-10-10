import {
  PostgresCursor,
  PostgresPool,
  PostgresPoolClient,
  PostgresQueryResult,
} from 'kysely';
import { SQLSTATE } from './postgres-persistence-errors';

const COMMIT_STATEMENT = 'commit';
const COMMITTED_TAG = 'COMMIT';

/**
 * PostgreSQL answers COMMIT on a failed transaction with the tag ROLLBACK and
 * no error. This is that answer, raised under the state the server gives any
 * other statement sent to a failed transaction.
 */
export class RolledBackAtCommitError extends Error {
  readonly code = SQLSTATE.IN_FAILED_SQL_TRANSACTION;

  constructor(readonly commandTag: string) {
    super(
      `COMMIT was answered with ${commandTag}: a statement had failed and nothing was stored`,
    );
    this.name = 'RolledBackAtCommitError';
  }
}

class CommitCheckedClient implements PostgresPoolClient {
  constructor(private readonly client: PostgresPoolClient) {}

  query<R>(
    sql: string,
    parameters: ReadonlyArray<unknown>,
  ): Promise<PostgresQueryResult<R>>;
  query<R>(cursor: PostgresCursor<R>): PostgresCursor<R>;
  query<R>(
    statement: string | PostgresCursor<R>,
    parameters: ReadonlyArray<unknown> = [],
  ): Promise<PostgresQueryResult<R>> | PostgresCursor<R> {
    if (typeof statement !== 'string') {
      return this.client.query(statement);
    }
    const answer = this.client.query<R>(statement, parameters);
    return isCommit(statement) ? committed(answer) : answer;
  }

  release(): void {
    this.client.release();
  }
}

function isCommit(statement: string): boolean {
  return statement.trim().toLowerCase() === COMMIT_STATEMENT;
}

async function committed<R>(
  answer: Promise<PostgresQueryResult<R>>,
): Promise<PostgresQueryResult<R>> {
  const result = await answer;
  const commandTag: string = result.command;
  if (commandTag !== COMMITTED_TAG) {
    throw new RolledBackAtCommitError(commandTag);
  }
  return result;
}

/**
 * The pool the query builder is given. Every COMMIT it sends has its command
 * tag read, so a commit that stored nothing is a failure and never a normal
 * return. One round trip, where a probe statement before COMMIT took two.
 */
export function commitCheckedPool(pool: PostgresPool): PostgresPool {
  // The query builder keys its own connection state by client object.
  const checked = new WeakMap<PostgresPoolClient, CommitCheckedClient>();
  return {
    connect: async () => {
      const client = await pool.connect();
      const known = checked.get(client);
      if (known) {
        return known;
      }
      const wrapped = new CommitCheckedClient(client);
      checked.set(client, wrapped);
      return wrapped;
    },
    end: () => pool.end(),
  };
}
