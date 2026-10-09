import { Driver, PostgresDialect, PostgresDialectConfig } from 'kysely';
import { LostCommitAnswers } from '../utils/session/issuance-contract/issuance-contract-harness';

interface CommitFault {
  lands: boolean;
}

/** What the driver raises when the connection drops before an answer arrives. */
function connectionLost(): Error {
  return Object.assign(new Error('the commit reply was lost'), {
    code: 'ECONNRESET',
  });
}

/**
 * The one place that reaches the driver's commit. With a fault set, the real
 * commit runs first (`lands`) or is replaced by a rollback, and its answer is
 * then lost. Nothing else about the driver changes.
 */
export class CommitFaultDialect extends PostgresDialect {
  private fault: CommitFault | undefined;
  private attempts = 0;

  constructor(config: PostgresDialectConfig) {
    super(config);
  }

  loseCommitAnswers(fault: CommitFault): LostCommitAnswers {
    this.fault = fault;
    this.attempts = 0;
    return {
      commitAttempts: () => this.attempts,
      restore: () => {
        this.fault = undefined;
      },
    };
  }

  createDriver(): Driver {
    const driver = super.createDriver();
    const commit = driver.commitTransaction.bind(driver);
    driver.commitTransaction = async (connection) => {
      const fault = this.fault;
      if (!fault) {
        return commit(connection);
      }
      this.attempts += 1;
      if (fault.lands) {
        await commit(connection);
      } else {
        await driver.rollbackTransaction(connection);
      }
      throw connectionLost();
    };
    return driver;
  }
}
