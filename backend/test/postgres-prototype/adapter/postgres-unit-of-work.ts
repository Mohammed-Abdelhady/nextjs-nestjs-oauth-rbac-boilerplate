import { ControlledTransaction, Kysely, Transaction } from 'kysely';
import { UnknownTransactionOutcomeError } from '../../../src/common/exceptions/unknown-transaction-outcome.error';
import { RetryableAbortError } from '../../../src/common/persistence/persistence-errors';
import {
  MAX_UNIT_OF_WORK_ATTEMPTS,
  pauseBeforeRerun,
  RerunPause,
  UnitOfWork,
  UnitOfWorkRunner,
} from '../../../src/common/persistence/unit-of-work';
import { PrototypeDatabase } from './postgres-database';
import { mapPostgresError, sqlStateOf } from './postgres-persistence-errors';

class PostgresUnitOfWork extends UnitOfWork {
  constructor(readonly transaction: Transaction<PrototypeDatabase>) {
    super();
  }
}

/** The open transaction, for the PostgreSQL adapter only. */
export function postgresTransactionOf(
  unitOfWork: UnitOfWork,
): Transaction<PrototypeDatabase> {
  if (!(unitOfWork instanceof PostgresUnitOfWork)) {
    throw new Error('This unit of work was not opened on PostgreSQL');
  }
  return unitOfWork.transaction;
}

/**
 * Read committed, as the plan decided. What must not interleave is kept apart by
 * a row lock the store takes, not by the isolation level.
 */
export class PostgresUnitOfWorkRunner extends UnitOfWorkRunner {
  constructor(
    private readonly database: Kysely<PrototypeDatabase>,
    private readonly pause: RerunPause = pauseBeforeRerun,
  ) {
    super();
  }

  async run<Result>(
    work: (unitOfWork: UnitOfWork) => Promise<Result>,
  ): Promise<Result> {
    for (let failed = 1; ; failed += 1) {
      try {
        return await this.attempt(work);
      } catch (error) {
        const final = failed >= MAX_UNIT_OF_WORK_ATTEMPTS;
        if (final || !(error instanceof RetryableAbortError)) {
          throw error;
        }
        await this.pause(failed);
      }
    }
  }

  private async attempt<Result>(
    work: (unitOfWork: UnitOfWork) => Promise<Result>,
  ): Promise<Result> {
    const transaction = await this.begin();
    let result: Result;
    try {
      result = await work(new PostgresUnitOfWork(transaction));
    } catch (error) {
      await this.release(transaction);
      throw mapPostgresError(error);
    }
    try {
      await transaction.commit().execute();
    } catch (error) {
      await this.release(transaction);
      throw commitFailure(error);
    }
    return result;
  }

  private async begin(): Promise<ControlledTransaction<PrototypeDatabase>> {
    try {
      return await this.database
        .startTransaction()
        .setIsolationLevel('read committed')
        .execute();
    } catch (error) {
      throw mapPostgresError(error);
    }
  }

  /** Rolls back and hands the connection back. The first failure is the one reported. */
  private async release(
    transaction: ControlledTransaction<PrototypeDatabase>,
  ): Promise<void> {
    try {
      await transaction.rollback().execute();
    } catch {
      return;
    }
  }
}

/**
 * A SQLSTATE means the server answered and the commit did not happen. That
 * includes a COMMIT answered with ROLLBACK because `work` swallowed a store
 * failure: the connection reads the command tag (`commitCheckedPool`), so a
 * normal return from `run` always means the work was committed. Without a
 * SQLSTATE the answer was lost, and the transaction may or may not be stored.
 */
function commitFailure(error: unknown): unknown {
  return sqlStateOf(error) === undefined
    ? new UnknownTransactionOutcomeError(error)
    : mapPostgresError(error);
}
