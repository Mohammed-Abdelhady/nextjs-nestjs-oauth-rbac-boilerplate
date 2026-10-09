import { Kysely } from 'kysely';
import { Pool } from 'pg';
import {
  openPrototypeDatabase,
  PrototypeDatabase,
} from '../../../test/postgres-prototype/adapter/postgres-database';
import { PostgresMailCounterStore } from '../../../test/postgres-prototype/adapter/postgres-mail-counter.store';
import { PostgresPasswordResetCodeStore } from '../../../test/postgres-prototype/adapter/postgres-password-reset-code.store';
import { PostgresPendingRegistrationStore } from '../../../test/postgres-prototype/adapter/postgres-pending-registration.store';
import {
  PENDING_CODE_OUTAGES,
  pendingCodeStatements,
  raisedBy,
} from '../../../test/utils/auth/store-outage-cases';
import { closedPort } from '../../../test/postgres-prototype/closed-port';

jest.mock('mongoose', () => {
  throw new Error('mongoose was loaded on the PostgreSQL path');
});
jest.mock('mongodb', () => {
  throw new Error('mongodb was loaded on the PostgreSQL path');
});
jest.mock('@nestjs/mongoose', () => {
  throw new Error('@nestjs/mongoose was loaded on the PostgreSQL path');
});

const A_UUID = '018f3c5e-7b1a-7c3e-9d2f-0a1b2c3d4e5f';

describe('PostgreSQL statements that commit by themselves', () => {
  let database: Kysely<PrototypeDatabase>;

  beforeAll(async () => {
    const pool = new Pool({ host: '127.0.0.1', port: await closedPort() });
    pool.on('error', () => undefined);
    database = openPrototypeDatabase(pool);
  });

  afterAll(async () => {
    await database.destroy();
  });

  it('raises the shared outage from every pending-code statement', async () => {
    const stores = {
      mailCounters: new PostgresMailCounterStore(database),
      registrations: new PostgresPendingRegistrationStore(database),
      passwordResets: new PostgresPasswordResetCodeStore(database),
    };

    // Records from before purposes exist only on MongoDB, so this adapter
    // answers that one without a statement.
    expect(await raisedBy(pendingCodeStatements(stores, A_UUID))).toEqual({
      ...PENDING_CODE_OUTAGES,
      'registration.clearLegacyBlocker': 'resolved',
    });
  });
});
