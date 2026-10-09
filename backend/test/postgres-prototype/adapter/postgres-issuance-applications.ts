import { UnitOfWork } from '../../../src/common/persistence/unit-of-work';
import { IssuanceApplication } from '../../../src/session/issuance/browser-issuance.store';
import { IssuanceApplications } from '../../../src/session/issuance/issuance-applications';
import { requireEnabledApplication } from '../../../src/session/utils/authority/application-rule';
import {
  APPLICATION_COLUMNS,
  toIssuanceApplication,
} from './postgres-issuance-mappers';
import { postgresTransactionOf } from './postgres-unit-of-work';

/**
 * Stands in for the application registry until that service has a store of its
 * own. It reads the row and applies the registry's one shared rule.
 */
export class PostgresIssuanceApplications extends IssuanceApplications {
  constructor(private readonly environment: string) {
    super();
  }

  async requireEnabled(
    unitOfWork: UnitOfWork,
    clientId: string,
  ): Promise<IssuanceApplication> {
    const row = await postgresTransactionOf(unitOfWork)
      .selectFrom('applications')
      .select(APPLICATION_COLUMNS)
      .where('client_id', '=', clientId)
      .where('environment', '=', this.environment)
      .executeTakeFirst();
    return requireEnabledApplication(row ? toIssuanceApplication(row) : null);
  }
}
