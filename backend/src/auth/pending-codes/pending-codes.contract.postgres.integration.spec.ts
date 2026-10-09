import { bootPostgresPendingCodesHarness } from '../../../test/postgres-prototype/postgres-pending-codes-harness';
import {
  POSTGRES_BOOT_TIMEOUT_MS,
  POSTGRES_TEARDOWN_TIMEOUT_MS,
} from '../../../test/postgres-prototype/server/postgres-test-server';
import { describePendingCodesContract } from '../../../test/utils/auth/pending-codes-contract/pending-codes-contract';

// The pending-code services and their ports must run here without the other
// database's driver. Loading any of these modules fails the suite.
jest.mock('mongoose', () => {
  throw new Error('mongoose was loaded on the PostgreSQL path');
});
jest.mock('mongodb', () => {
  throw new Error('mongodb was loaded on the PostgreSQL path');
});
jest.mock('@nestjs/mongoose', () => {
  throw new Error('@nestjs/mongoose was loaded on the PostgreSQL path');
});

describePendingCodesContract('PostgreSQL', bootPostgresPendingCodesHarness, {
  bootMs: POSTGRES_BOOT_TIMEOUT_MS,
  teardownMs: POSTGRES_TEARDOWN_TIMEOUT_MS,
});
