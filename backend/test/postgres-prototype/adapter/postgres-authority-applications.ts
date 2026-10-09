import { Kysely } from 'kysely';
import {
  AuthorityApplication,
  AuthorityApplications,
} from '../../../src/session/authority/authority-applications';
import { PrototypeDatabase } from './postgres-database';
import {
  APPLICATION_COLUMNS,
  toIssuanceApplication,
} from './postgres-issuance-mappers';
import { autocommit } from './postgres-pending-codes-database';

/**
 * Stands in for the application registry until that service has a store of its
 * own. Each read is a committed authority read: one statement on the primary.
 */
export class PostgresAuthorityApplications extends AuthorityApplications {
  constructor(
    private readonly database: Kysely<PrototypeDatabase>,
    private readonly environment: string,
  ) {
    super();
  }

  async findByClientId(clientId: string): Promise<AuthorityApplication | null> {
    const row = await autocommit({}, () =>
      this.database
        .selectFrom('applications')
        .select(APPLICATION_COLUMNS)
        .where('client_id', '=', clientId)
        .where('environment', '=', this.environment)
        .executeTakeFirst(),
    );
    return row ? toIssuanceApplication(row) : null;
  }

  async findByClientIds(clientIds: string[]): Promise<AuthorityApplication[]> {
    if (clientIds.length === 0) {
      return [];
    }
    const rows = await autocommit({}, () =>
      this.database
        .selectFrom('applications')
        .select(APPLICATION_COLUMNS)
        .where('client_id', 'in', clientIds)
        .where('environment', '=', this.environment)
        .execute(),
    );
    return rows.map(toIssuanceApplication);
  }
}
