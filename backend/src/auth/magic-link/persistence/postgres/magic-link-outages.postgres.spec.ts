import { Kysely } from 'kysely';
import { Pool } from 'pg';
import {
  openPrototypeDatabase,
  PrototypeDatabase,
} from '../../../../../test/postgres-prototype/adapter/postgres-database';
import {
  PostgresMagicLinkAccounts,
  PostgresMagicLinkStore,
} from '../../../../../test/postgres-prototype/adapter/postgres-magic-link.store';
import { raisedBy } from '../../../../../test/utils/auth/store-outage-cases';
import { closedPort } from '../../../../../test/postgres-prototype/closed-port';
import {
  MAGIC_LINK_OUTAGES,
  magicLinkStatements,
} from '../../contract/magic-link-outage-cases.harness-spec';

jest.mock('mongoose', () => {
  throw new Error('mongoose was loaded on the PostgreSQL path');
});
jest.mock('mongodb', () => {
  throw new Error('mongodb was loaded on the PostgreSQL path');
});
jest.mock('@nestjs/mongoose', () => {
  throw new Error('@nestjs/mongoose was loaded on the PostgreSQL path');
});

describe('PostgreSQL magic link statements that commit by themselves', () => {
  let database: Kysely<PrototypeDatabase>;

  beforeAll(async () => {
    const pool = new Pool({ host: '127.0.0.1', port: await closedPort() });
    pool.on('error', () => undefined);
    database = openPrototypeDatabase(pool);
  });

  afterAll(async () => {
    await database.destroy();
  });

  it('raises the shared outage from every link and account statement', async () => {
    const statements = magicLinkStatements(
      new PostgresMagicLinkStore(database),
      new PostgresMagicLinkAccounts(database),
    );

    expect(await raisedBy(statements)).toEqual(MAGIC_LINK_OUTAGES);
  });
});
