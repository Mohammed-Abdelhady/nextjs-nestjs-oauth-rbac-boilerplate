import { bootPostgresTwoFactorHarness } from '../../../../test/postgres-prototype/postgres-two-factor-harness';
import {
  POSTGRES_BOOT_TIMEOUT_MS,
  POSTGRES_TEARDOWN_TIMEOUT_MS,
} from '../../../../test/postgres-prototype/server/postgres-test-server';
import { describeTwoFactorContract } from './two-factor-contract-suite.harness-spec';

// The second factor services and their ports must run here without the other
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

describeTwoFactorContract('PostgreSQL', bootPostgresTwoFactorHarness, {
  bootMs: POSTGRES_BOOT_TIMEOUT_MS,
  teardownMs: POSTGRES_TEARDOWN_TIMEOUT_MS,
});
