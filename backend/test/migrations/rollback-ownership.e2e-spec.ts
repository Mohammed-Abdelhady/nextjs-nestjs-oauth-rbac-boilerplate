import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

/* eslint-disable @typescript-eslint/no-require-imports */
const defaultPermissions =
  require('../../migrations/20260904000001-add-default-permissions-to-users.js') as {
    up: (db: unknown) => Promise<void>;
    down: (db: unknown) => Promise<void>;
  };
const linkedAccounts =
  require('../../migrations/20260904000002-linked-accounts.js') as {
    up: (db: unknown) => Promise<void>;
    down: (db: unknown) => Promise<void>;
  };
const primaryProvider =
  require('../../migrations/20260904000003-backfill-email-primary-provider.js') as {
    up: (db: unknown) => Promise<void>;
    down: (db: unknown) => Promise<void>;
  };
/* eslint-enable @typescript-eslint/no-require-imports */

describe('migration rollback ownership', () => {
  let mongo: MongoMemoryServer;
  let client: MongoClient;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    client = await MongoClient.connect(mongo.getUri());
  });

  afterAll(async () => {
    await client.close();
    await mongo.stop();
  });

  beforeEach(async () => {
    await client.db().dropDatabase();
  });

  it('should leave a pre-existing default permission intact across up then down', async () => {
    const users = client.db().collection('users');
    const ownedId = new ObjectId();
    const preexistingId = new ObjectId();
    await users.insertMany([
      { _id: ownedId, role: 'user', permissions: [] },
      {
        _id: preexistingId,
        role: 'user',
        permissions: ['profile:read:own', 'profile:update:own', 'custom:grant'],
      },
    ]);

    await defaultPermissions.up(client.db());
    await defaultPermissions.down(client.db());

    const preexisting = await users.findOne({ _id: preexistingId });
    expect(preexisting?.permissions).toEqual([
      'profile:read:own',
      'profile:update:own',
      'custom:grant',
    ]);
    const owned = await users.findOne({ _id: ownedId });
    expect(owned?.permissions ?? []).not.toContain('profile:read:own');
  });

  it('should refuse to roll back a non-legacy linked provider', async () => {
    const users = client.db().collection('users');
    await users.insertOne({
      googleId: 'g-1',
      authProvider: 'google',
    });
    await linkedAccounts.up(client.db());
    await users.updateOne(
      { googleId: { $exists: false } },
      {
        $push: {
          linkedAccounts: {
            provider: 'microsoft',
            providerId: 'ms-1',
            linkedAt: new Date(),
          },
        } as never,
      },
    );

    await expect(linkedAccounts.down(client.db())).rejects.toThrow(
      /legacy schema cannot store/,
    );
  });

  it('should restore only primaryProvider values this migration wrote', async () => {
    const users = client.db().collection('users');
    const ownedId = new ObjectId();
    const preexistingId = new ObjectId();
    await users.insertMany([
      { _id: ownedId, authProvider: 'email' },
      {
        _id: preexistingId,
        authProvider: 'email',
        primaryProvider: 'email',
      },
    ]);

    await primaryProvider.up(client.db());
    await users.updateOne(
      { _id: ownedId },
      { $set: { primaryProvider: 'google' } },
    );
    await primaryProvider.down(client.db());

    const owned = await users.findOne({ _id: ownedId });
    expect(owned?.primaryProvider).toBe('google');
    const preexisting = await users.findOne({ _id: preexistingId });
    expect(preexisting?.primaryProvider).toBe('email');
  });
});
