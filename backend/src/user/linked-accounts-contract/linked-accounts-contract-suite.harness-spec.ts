import { TEST_NOW } from '../../../test/utils/frozen-clock';
import { linkedAccountCases } from './linked-accounts-contract-cases.harness-spec';
import { profileSyncCases } from './linked-accounts-contract-sync.harness-spec';
import {
  LinkedAccountsContractHarness,
  LinkedFixture,
  seedLinkedFixture,
} from './linked-accounts-contract.harness-spec';

/**
 * The linked-account store's contract. Every database runs these same cases
 * through its own harness, with the real services built on its adapter.
 */
export function describeLinkedAccountsContract(
  database: string,
  boot: () => Promise<LinkedAccountsContractHarness>,
  budgets: { bootMs: number; teardownMs: number },
): void {
  describe(`linked accounts contract on ${database}`, () => {
    let harness: LinkedAccountsContractHarness | undefined;
    let fixture: LinkedFixture | undefined;

    const current = (): LinkedAccountsContractHarness => {
      if (!harness) {
        throw new Error(`the ${database} harness did not start`);
      }
      return harness;
    };
    const seeded = (): LinkedFixture => {
      if (!fixture) {
        throw new Error('the linked accounts fixture was not seeded');
      }
      return fixture;
    };

    beforeAll(async () => {
      harness = await boot();
    }, budgets.bootMs);

    afterAll(async () => {
      await harness?.close();
    }, budgets.teardownMs);

    beforeEach(async () => {
      current().clock.set(TEST_NOW);
      await current().reset();
      fixture = await seedLinkedFixture(current());
    });

    afterEach(() => jest.restoreAllMocks());

    linkedAccountCases(current, seeded);
    profileSyncCases(current, seeded);
  });
}
