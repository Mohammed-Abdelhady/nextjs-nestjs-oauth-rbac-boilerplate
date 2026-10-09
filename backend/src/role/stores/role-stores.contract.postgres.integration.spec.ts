import { bootPostgresRoleHarness } from '../../../test/postgres-prototype/postgres-role-harness';
import {
  POSTGRES_BOOT_TIMEOUT_MS,
  POSTGRES_TEARDOWN_TIMEOUT_MS,
} from '../../../test/postgres-prototype/server/postgres-test-server';
import { describeRoleStoresContract } from '../../../test/utils/role/role-contract/role-contract';

// The role services and their ports must run here without the other database's
// driver. Loading any of these modules fails the suite.
jest.mock('mongoose', () => {
  throw new Error('mongoose was loaded on the PostgreSQL path');
});
jest.mock('mongodb', () => {
  throw new Error('mongodb was loaded on the PostgreSQL path');
});
jest.mock('@nestjs/mongoose', () => {
  throw new Error('@nestjs/mongoose was loaded on the PostgreSQL path');
});

describeRoleStoresContract('PostgreSQL', bootPostgresRoleHarness, {
  bootMs: POSTGRES_BOOT_TIMEOUT_MS,
  teardownMs: POSTGRES_TEARDOWN_TIMEOUT_MS,
});
