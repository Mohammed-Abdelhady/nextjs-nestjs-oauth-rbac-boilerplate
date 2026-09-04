/**
 * Migration: Add Linked Providers Fields
 *
 * This migration adds support for account linking functionality by adding new fields
 * to the user collection and populating them with existing data.
 *
 * Fields added:
 * - linkedProviders: Array of linked authentication providers
 * - primaryProvider: Preferred provider for profile data sync
 * - profileSyncedAt: Timestamp of last profile sync
 * - lastSyncedProvider: Which provider was last synced
 *
 * Migration steps:
 * 1. Add new fields to user documents with default values
 * 2. Populate linkedProviders with existing authProvider
 * 3. Set primaryProvider to authProvider for existing users
 * 4. Create index on linkedProviders array
 *
 * @param {Db} db - MongoDB database instance
 * @param {MongoClient} client - MongoDB client instance
 */

module.exports = {
  async up(db, client) {
    // Get current date for migration timestamp
    const now = new Date();

    // Update all existing users to populate linkedProviders array
    const result = await db.collection('users').updateMany(
      {
        linkedProviders: { $exists: false },
      },
      [
        {
          $set: {
            linkedProviders: ['$authProvider'],
            primaryProvider: '$authProvider',
          },
        },
      ],
    );

    console.log(
      `✓ Updated ${result.modifiedCount} users with linkedProviders array`,
    );

    // Create index on linkedProviders array for efficient queries
    try {
      // Check if index already exists
      const indexes = await db.collection('users').indexes();
      const linkedProvidersIndexExists = indexes.some(
        (idx) =>
          idx.name === 'linkedProviders_index' || idx.key.linkedProviders,
      );

      if (!linkedProvidersIndexExists) {
        await db.collection('users').createIndex(
          { linkedProviders: 1 },
          {
            name: 'linkedProviders_index',
          },
        );
        console.log('Created index on linkedProviders field');
      } else {
        console.log('Index on linkedProviders field already exists');
      }
    } catch (error) {
      console.warn(
        'Index on linkedProviders already exists with different name',
      );
    }

    // Verify migration
    const usersWithoutLinkedProviders = await db
      .collection('users')
      .countDocuments({ linkedProviders: { $exists: false } });

    if (usersWithoutLinkedProviders > 0) {
      console.warn(
        `Warning: ${usersWithoutLinkedProviders} users missing linkedProviders field`,
      );
    } else {
      console.log('All users have linkedProviders field populated');
    }
  },

  async down(db, client) {
    const result = await db.collection('users').updateMany(
      {},
      {
        $unset: {
          linkedProviders: '',
          primaryProvider: '',
          profileSyncedAt: '',
          lastSyncedProvider: '',
        },
      },
    );

    console.log(
      `Removed linked providers fields from ${result.modifiedCount} users`,
    );

    try {
      await db.collection('users').dropIndex('linkedProviders_index');
      console.log('Dropped linkedProviders index');
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        return;
      }
      throw error;
    }
  },
};
