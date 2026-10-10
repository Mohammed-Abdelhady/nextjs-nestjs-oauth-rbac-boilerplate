import { Pool } from 'pg';
import {
  STORE_HEALTH,
  StoreHealth,
  StoreHealthState,
} from '../../../src/health/store-health';

/**
 * A server in recovery is a standby, and a session that may only read cannot
 * take a write either. Both are told apart from a server that does not answer.
 */
const WRITABLE = `
  SELECT NOT pg_is_in_recovery()
     AND current_setting('transaction_read_only') = 'off' AS writable`;

/**
 * The pool keeps no connection state of its own, so this adapter asks the
 * server when told to and remembers the answer. Until it has asked once it
 * knows nothing, and says the store is unreachable.
 */
export class PostgresStoreHealth extends StoreHealth {
  private state: StoreHealthState = STORE_HEALTH.UNREACHABLE;

  constructor(private readonly pool: Pick<Pool, 'query'>) {
    super();
  }

  current(): StoreHealthState {
    return this.state;
  }

  /** Asks the server once and keeps what it said. Never throws. */
  async observe(): Promise<StoreHealthState> {
    try {
      const answer = await this.pool.query<{ writable: boolean }>(WRITABLE);
      this.state =
        answer.rows[0]?.writable === true
          ? STORE_HEALTH.READY
          : STORE_HEALTH.NOT_WRITABLE;
    } catch {
      this.state = STORE_HEALTH.UNREACHABLE;
    }
    return this.state;
  }
}
