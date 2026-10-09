import { sql } from 'kysely';
import { postgresTransactionOf } from '../adapter/postgres-unit-of-work';
import { PostgresIssuanceHarness } from '../postgres-issuance-harness';
import { rerunAtOnce } from '../../utils/session/issuance-contract/issuance-contract-support';

export const FAILED_ON_PURPOSE = 'failed on purpose with a transaction open';

/**
 * Leaves what a case that fails or runs out of its budget leaves: one unit of
 * work that holds an account and never ends, and a second one whose statement
 * waits on that account. Resolves once the server reports the second waiting.
 */
export async function abandonWorkOnAnAccount(
  harness: PostgresIssuanceHarness,
): Promise<void> {
  const userId = await harness.seedAccount();
  const never = new Promise<void>(() => undefined);
  const takeAccount = (
    unitOfWork: Parameters<typeof postgresTransactionOf>[0],
  ) =>
    sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`.execute(
      postgresTransactionOf(unitOfWork),
    );

  await new Promise<void>((taken) => {
    void harness
      .runner(rerunAtOnce)
      .run(async (unitOfWork) => {
        await takeAccount(unitOfWork);
        taken();
        await never;
      })
      .catch(() => undefined);
  });
  void harness
    .runner(rerunAtOnce)
    .run(async (unitOfWork) => {
      await takeAccount(unitOfWork);
    })
    .catch(() => undefined);

  for (;;) {
    const waiting = await harness.pool.query(
      `SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock'`,
    );
    if (waiting.rowCount === 1) {
      return;
    }
  }
}

export async function storedAccounts(
  harness: PostgresIssuanceHarness,
): Promise<number> {
  const counted = await harness.pool.query<{ total: string }>(
    'SELECT count(*) AS total FROM users',
  );
  return Number.parseInt(counted.rows[0].total, 10);
}
