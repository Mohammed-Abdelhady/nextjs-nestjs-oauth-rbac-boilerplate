import * as bcrypt from 'bcrypt';
import { TEST_NOW } from '../../../../test/utils/frozen-clock';
import { counterCases } from './passkeys-contract-counter.harness-spec';
import { managementCases } from './passkeys-contract-management.harness-spec';
import { removalRaceCases } from './passkeys-contract-removal-race.harness-spec';
import { registrationRuleCases } from './passkeys-contract-registration-rules.harness-spec';
import { registrationCases } from './passkeys-contract-registration.harness-spec';
import { routeIdCases } from './passkeys-contract-route-ids.harness-spec';
import { seamCases } from './passkeys-contract-seam.harness-spec';
import { signInRuleCases } from './passkeys-contract-sign-in-rules.harness-spec';
import { signInCases } from './passkeys-contract-sign-in.harness-spec';
import {
  BCRYPT_ROUNDS,
  OTHER_EMAIL,
  OWNER_EMAIL,
  PasskeysContractHarness,
  PasskeysFixture,
  PASSWORD,
} from './passkeys-contract.harness-spec';

/**
 * The passkey stores' contract. Every database runs these same cases through
 * its own harness, with the real services built on its adapters.
 */
export function describePasskeysContract(
  database: string,
  boot: () => Promise<PasskeysContractHarness>,
  budgets: { bootMs: number; teardownMs: number; resetMs: number },
): void {
  describe(`passkeys contract on ${database}`, () => {
    let harness: PasskeysContractHarness | undefined;
    let fixture: PasskeysFixture | undefined;
    let passwordHash = '';

    const current = (): PasskeysContractHarness => {
      if (!harness) {
        throw new Error(`the ${database} harness did not start`);
      }
      return harness;
    };
    const seeded = (): PasskeysFixture => {
      if (!fixture) {
        throw new Error('the passkeys fixture was not seeded');
      }
      return fixture;
    };

    beforeAll(async () => {
      passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
      harness = await boot();
    }, budgets.bootMs);

    afterAll(async () => {
      await harness?.close();
    }, budgets.teardownMs);

    beforeEach(async () => {
      const { clock } = current();
      clock.set(TEST_NOW);
      // The services read the time through Date.now, so it follows the clock.
      jest.spyOn(Date, 'now').mockImplementation(() => clock.now().getTime());
      await current().reset();
      fixture = {
        ownerId: await current().seedAccount({
          email: OWNER_EMAIL,
          passwordHash,
        }),
        otherId: await current().seedAccount({
          email: OTHER_EMAIL,
          passwordHash,
        }),
      };
    }, budgets.resetMs);

    afterEach(() => jest.restoreAllMocks());

    registrationCases(current, seeded);
    registrationRuleCases(current, seeded);
    signInCases(current, seeded);
    signInRuleCases(current, seeded);
    counterCases(current, seeded);
    managementCases(current, seeded);
    removalRaceCases(current);
    seamCases(current, seeded);
    routeIdCases(current, seeded);
  });
}
