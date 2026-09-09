/**
 * Migration: Move per-provider id fields into linkedAccounts
 *
 * up()   copies googleId/facebookId/githubId into linkedAccounts entries
 *        [{ provider, providerId, linkedAt }], unsets the old fields and the
 *        stored linkedProviders array (now derived from linkedAccounts), drops
 *        the per-provider unique indexes and creates the compound unique index.
 * down() rebuilds the id fields and linkedProviders from linkedAccounts and
 *        restores the old indexes. It fails closed when any linked account uses
 *        a provider the legacy schema cannot represent.
 */

const PROVIDER_ID_FIELDS = {
  google: 'googleId',
  facebook: 'facebookId',
  github: 'githubId',
};

const EMAIL_PROVIDER = 'email';
const BATCH_SIZE = 500;

const LEGACY_INDEX_NAMES = [
  'googleId_unique',
  'facebookId_unique',
  'githubId_unique',
  'googleId_1',
  'facebookId_1',
  'githubId_1',
  'linkedProviders_1',
];

const LINKED_ACCOUNTS_INDEX = {
  'linkedAccounts.provider': 1,
  'linkedAccounts.providerId': 1,
};

async function dropIndexIfExists(collection, name) {
  try {
    await collection.dropIndex(name);
    console.log(`Dropped index ${name}`);
  } catch (error) {
    if (error.codeName !== 'IndexNotFound' && error.code !== 27) {
      throw error;
    }
  }
}

async function flush(collection, operations) {
  if (operations.length === 0) {
    return 0;
  }
  const result = await collection.bulkWrite(operations);
  return result.modifiedCount;
}

module.exports = {
  async up(db) {
    const users = db.collection('users');
    const cursor = users.find({
      $or: Object.values(PROVIDER_ID_FIELDS).map((field) => ({
        [field]: { $exists: true, $ne: null },
      })),
    });

    let operations = [];
    let migrated = 0;

    while (await cursor.hasNext()) {
      const user = await cursor.next();
      if (!user) {
        continue;
      }

      const linkedAt = user.updatedAt || user.createdAt || new Date();
      const existing = Array.isArray(user.linkedAccounts)
        ? user.linkedAccounts
        : [];
      const linkedAccounts = [...existing];

      for (const [provider, field] of Object.entries(PROVIDER_ID_FIELDS)) {
        const providerId = user[field];
        if (!providerId) {
          continue;
        }
        const alreadyLinked = linkedAccounts.some(
          (account) => account.provider === provider,
        );
        if (!alreadyLinked) {
          linkedAccounts.push({
            provider,
            providerId: String(providerId),
            linkedAt,
          });
        }
      }

      operations.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: { linkedAccounts },
            $unset: {
              googleId: '',
              facebookId: '',
              githubId: '',
              linkedProviders: '',
            },
          },
        },
      });

      if (operations.length >= BATCH_SIZE) {
        migrated += await flush(users, operations);
        operations = [];
      }
    }

    migrated += await flush(users, operations);

    await users.updateMany(
      { linkedAccounts: { $exists: false } },
      { $set: { linkedAccounts: [] }, $unset: { linkedProviders: '' } },
    );

    for (const name of LEGACY_INDEX_NAMES) {
      await dropIndexIfExists(users, name);
    }

    await users.createIndex(LINKED_ACCOUNTS_INDEX, {
      unique: true,
      sparse: true,
    });

    console.log(`Moved provider ids into linkedAccounts for ${migrated} users`);
  },

  async down(db) {
    const users = db.collection('users');
    const cursor = users.find({ linkedAccounts: { $exists: true } });

    let operations = [];
    let restored = 0;

    while (await cursor.hasNext()) {
      const user = await cursor.next();
      if (!user) {
        continue;
      }

      const linkedAccounts = Array.isArray(user.linkedAccounts)
        ? user.linkedAccounts
        : [];
      const unsupported = linkedAccounts.filter(
        (account) =>
          account && account.provider && !PROVIDER_ID_FIELDS[account.provider],
      );
      if (unsupported.length > 0) {
        const providers = [
          ...new Set(unsupported.map((account) => account.provider)),
        ].join(', ');
        throw new Error(
          `Cannot roll back linkedAccounts: user ${user._id} has provider(s) ${providers} that the legacy schema cannot store`,
        );
      }
      const providerIds = {};
      const linkedProviders = [];

      if (user.authProvider === EMAIL_PROVIDER) {
        linkedProviders.push(EMAIL_PROVIDER);
      }

      for (const account of linkedAccounts) {
        const field = PROVIDER_ID_FIELDS[account.provider];
        if (field) {
          providerIds[field] = account.providerId;
        }
        linkedProviders.push(account.provider);
      }

      operations.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: { ...providerIds, linkedProviders },
            $unset: { linkedAccounts: '' },
          },
        },
      });

      if (operations.length >= BATCH_SIZE) {
        restored += await flush(users, operations);
        operations = [];
      }
    }

    restored += await flush(users, operations);

    await dropIndexIfExists(
      users,
      'linkedAccounts.provider_1_linkedAccounts.providerId_1',
    );

    for (const field of Object.values(PROVIDER_ID_FIELDS)) {
      await users.createIndex({ [field]: 1 }, { unique: true, sparse: true });
    }
    await users.createIndex({ linkedProviders: 1 });

    console.log(`Restored per-provider id fields for ${restored} users`);
  },
};
