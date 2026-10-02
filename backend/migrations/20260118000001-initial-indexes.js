const { dropIndexIfExists } = require(
  '../migration-support/migration-index-utils',
);

/**
 * Migration: Initial Indexes
 *
 * Mongoose schemas own index declarations.
 * The User schema declares email, role, isDeleted, createdAt, and OAuth ID indexes.
 * No additional indexes are required here.
 */

module.exports = {
  async up(db, client) {
    console.log(
      'Mongoose schemas own index declarations. No additional indexes required.',
    );
  },

  async down(db, client) {
    const legacyIndexNames = [
      'email_unique',
      'createdAt_isDeleted_compound',
      'role_index',
      'isDeleted_index',
      'googleId_unique',
      'facebookId_unique',
      'githubId_unique',
    ];

    const usersCollection = db.collection('users');

    for (const indexName of legacyIndexNames) {
      if (await dropIndexIfExists(usersCollection, indexName)) {
        console.log(`Dropped index ${indexName}`);
      }
    }
  },
};
