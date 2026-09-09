/**
 * Migration: Backfill primaryProvider for email accounts
 *
 * Accounts created with email and password before this change were stored
 * without a primaryProvider, while accounts migrated by
 * 20260119000001-add-linked-providers got one. This sets 'email' on the
 * accounts that are missing it, so profile sync reads the same field for all
 * of them.
 *
 * Ownership of the backfill is recorded in migration_state so down() unsets
 * only the values this run wrote that are still 'email'.
 */

const EMAIL_PROVIDER = 'email';
const STATE_ID = '20260904000003-backfill-email-primary-provider';

module.exports = {
  async up(db) {
    const users = db.collection('users');
    const owned = await users
      .find({
        authProvider: EMAIL_PROVIDER,
        primaryProvider: { $exists: false },
      })
      .project({ _id: 1 })
      .toArray();
    const ownedIds = owned.map((user) => user._id);

    const result = await users.updateMany(
      {
        authProvider: EMAIL_PROVIDER,
        primaryProvider: { $exists: false },
      },
      { $set: { primaryProvider: EMAIL_PROVIDER } },
    );

    await db
      .collection('migration_state')
      .updateOne(
        { _id: STATE_ID },
        { $set: { userIds: ownedIds, appliedAt: new Date() } },
        { upsert: true },
      );

    console.log(`Set primaryProvider on ${result.modifiedCount} email users`);
  },

  async down(db) {
    const state = await db.collection('migration_state').findOne({
      _id: STATE_ID,
    });
    const ownedIds = Array.isArray(state?.userIds) ? state.userIds : [];

    const result =
      ownedIds.length === 0
        ? { modifiedCount: 0 }
        : await db.collection('users').updateMany(
            {
              _id: { $in: ownedIds },
              authProvider: EMAIL_PROVIDER,
              primaryProvider: EMAIL_PROVIDER,
            },
            { $unset: { primaryProvider: '' } },
          );

    await db.collection('migration_state').deleteOne({ _id: STATE_ID });

    console.log(
      `Removed primaryProvider from ${result.modifiedCount} email users`,
    );
  },
};
