import { TEST_NOW } from '../../frozen-clock';
import { PendingCodesContractHarness } from './pending-codes-contract-harness';
import { registrationClaimCases } from './pending-codes-contract-claim';
import { registrationIssueCases } from './pending-codes-contract-issue';
import { mailCounterCases } from './pending-codes-contract-mail';
import { registrationRecordCases } from './pending-codes-contract-records';
import { passwordResetCases } from './pending-codes-contract-reset';
import { pendingCodeSeamCases } from './pending-codes-contract-seam';
import { registrationVerifyCases } from './pending-codes-contract-verify';

/**
 * The pending-code contract: mail counters, sign-up and email-change codes and
 * password reset codes. Every database runs these same cases through its own
 * harness, and offering a database means passing all of them.
 */
export function describePendingCodesContract(
  database: string,
  boot: () => Promise<PendingCodesContractHarness>,
  budgets: { bootMs: number; teardownMs: number },
): void {
  describe(`pending codes contract on ${database}`, () => {
    let harness: PendingCodesContractHarness | undefined;

    const current = (): PendingCodesContractHarness => {
      if (!harness) {
        throw new Error(`the ${database} harness did not start`);
      }
      return harness;
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
    });

    describe('mail counters', () => mailCounterCases(current));
    describe('issuing a sign-up code', () => registrationIssueCases(current));
    describe('verifying a sign-up code', () =>
      registrationVerifyCases(current));
    describe('code records', () => registrationRecordCases(current));
    describe('claiming a sign-up code', () => registrationClaimCases(current));
    describe('password reset codes', () => passwordResetCases(current));
    describe('the seam', () => pendingCodeSeamCases(current));
  });
}
