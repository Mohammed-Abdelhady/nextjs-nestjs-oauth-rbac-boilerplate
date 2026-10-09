import {
  bootPostgresIssuanceHarness,
  PostgresIssuanceHarness,
} from '../postgres-issuance-harness';
import { openPrototypeConnectionOn } from '../postgres-connection';
import {
  POSTGRES_BOOT_TIMEOUT_MS,
  POSTGRES_TEARDOWN_TIMEOUT_MS,
} from '../server/postgres-test-server';
import {
  abandonWorkOnAnAccount,
  FAILED_ON_PURPOSE,
  storedAccounts,
} from './abandoned-work';

// Run only by postgres-harness-teardown.integration.spec.ts, in a process of
// its own. Two cases of the first suite fail on purpose.
describe('a suite whose cases abandon open work', () => {
  let harness: PostgresIssuanceHarness;

  beforeAll(async () => {
    harness = await bootPostgresIssuanceHarness();
  }, POSTGRES_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await harness?.close();
  }, POSTGRES_TEARDOWN_TIMEOUT_MS);

  it('fails with an account held and a second writer waiting', async () => {
    await abandonWorkOnAnAccount(harness);

    throw new Error(FAILED_ON_PURPOSE);
  });

  it('starts the next case on empty tables', async () => {
    await harness.reset();
    await harness.seedAccount();

    expect(await storedAccounts(harness)).toBe(1);
  });

  it('fails again as the last case, so teardown meets the open work', async () => {
    await abandonWorkOnAnAccount(harness);

    throw new Error(FAILED_ON_PURPOSE);
  });
});

// Boots its own server after the first suite's teardown, in the same process.
describe('the suite that runs next', () => {
  let harness: PostgresIssuanceHarness;

  beforeAll(async () => {
    harness = await bootPostgresIssuanceHarness();
  }, POSTGRES_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await harness?.close();
  }, POSTGRES_TEARDOWN_TIMEOUT_MS);

  it('starts on empty tables and stores its own account', async () => {
    await harness.reset();
    await harness.seedAccount();

    expect(await storedAccounts(harness)).toBe(1);
  });
});

// Its boot fails after the server is up, so no harness exists to close.
describe('a suite whose boot fails part way', () => {
  beforeAll(async () => {
    await openPrototypeConnectionOn(() => {
      throw new Error(FAILED_ON_PURPOSE);
    });
  }, POSTGRES_BOOT_TIMEOUT_MS);

  it('never runs its case', () => {
    expect(true).toBe(true);
  });
});
