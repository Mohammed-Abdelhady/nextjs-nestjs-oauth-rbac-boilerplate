import { UnitOfWork } from '../../../src/common/persistence/unit-of-work';
import { ApplicationRegistry } from '../../../src/session/applications/application-registry';
import { issuanceApplicationOf } from '../../../src/session/applications/application-registry.store';
import { IssuanceApplication } from '../../../src/session/issuance/browser-issuance.store';
import { IssuanceApplications } from '../../../src/session/issuance/issuance-applications';

/** Sign-in's view of the registry: the registry itself, on its real store. */
export class PostgresIssuanceApplications extends IssuanceApplications {
  constructor(private readonly registry: ApplicationRegistry) {
    super();
  }

  async requireEnabled(
    unitOfWork: UnitOfWork,
    clientId: string,
  ): Promise<IssuanceApplication> {
    return issuanceApplicationOf(
      await this.registry.requireEnabledIn(unitOfWork, clientId),
    );
  }
}
