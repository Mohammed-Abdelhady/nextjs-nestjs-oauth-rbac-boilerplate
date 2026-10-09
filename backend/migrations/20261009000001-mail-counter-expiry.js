// Legacy counters have no recorded window length. Use the configured lifetime
// ceiling so the TTL cannot reset a quota before its original window ends.
const {
  dropIndexIfExists,
} = require('../migration-support/migration-index-utils');

const COLLECTION = 'mailcounters';
const TTL_INDEX = 'expiresAt_1';
const MAX_WINDOW_MS = 60 * 60 * 1000;

module.exports = {
  async up(db) {
    const counters = db.collection(COLLECTION);

    const backfilled = await counters.updateMany(
      { expiresAt: { $exists: false } },
      [
        {
          $set: {
            expiresAt: {
              $add: [{ $ifNull: ['$windowStartedAt', '$$NOW'] }, MAX_WINDOW_MS],
            },
          },
        },
      ],
    );
    console.log(`Set an expiry on ${backfilled.modifiedCount} mail counters`);

    await counters.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: TTL_INDEX },
    );
  },

  async down(db) {
    await dropIndexIfExists(db.collection(COLLECTION), TTL_INDEX);
  },
};
