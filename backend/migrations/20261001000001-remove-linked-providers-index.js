const { dropIndexIfExists } = require(
  '../migration-support/migration-index-utils',
);

module.exports = {
  async up(db) {
    await dropIndexIfExists(
      db.collection('users'),
      'linkedProviders_index',
    );
  },

  async down() {
    // The previous presence and options are unknown, so rollback leaves it absent.
  },
};
