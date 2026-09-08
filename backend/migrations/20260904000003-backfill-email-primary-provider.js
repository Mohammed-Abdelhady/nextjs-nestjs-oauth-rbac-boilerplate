/**
 * Migration: Backfill primaryProvider for email accounts
 *
 * Accounts created with email and password before this change were stored
 * without a primaryProvider, while accounts migrated by
 * 20260119000001-add-linked-providers got one. This sets 'email' on the
 * accounts that are missing it, so profile sync reads the same field for all
 * of them.
 *
 * The stored linkedProviders array is not touched here: it is derived from
 * authProvider and linkedAccounts, and 20260904000002-linked-accounts removes
 * the stored copy.
 *
 * down() unsets primaryProvider on email accounts that hold 'email'. It cannot
 * tell the rows this migration set apart from rows that already held the same
 * value, so the rollback covers both.
 */

const EMAIL_PROVIDER = 'email';

module.exports = {
  async up(db) {
    const result = await db.collection('users').updateMany(
      {
        authProvider: EMAIL_PROVIDER,
        primaryProvider: { $exists: false },
      },
      { $set: { primaryProvider: EMAIL_PROVIDER } },
    );

    console.log(`Set primaryProvider on ${result.modifiedCount} email users`);
  },

  async down(db) {
    const result = await db.collection('users').updateMany(
      {
        authProvider: EMAIL_PROVIDER,
        primaryProvider: EMAIL_PROVIDER,
      },
      { $unset: { primaryProvider: '' } },
    );

    console.log(
      `Removed primaryProvider from ${result.modifiedCount} email users`,
    );
  },
};
