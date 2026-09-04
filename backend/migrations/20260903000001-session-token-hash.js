/**
 * Migration: Session Token Hash
 *
 * Drops the legacy plaintext refreshToken index and creates a unique index on tokenHash.
 * Invalidates existing sessions because plaintext tokens cannot be hashed retroactively.
 * Users must sign in again to create hashed sessions.
 */

module.exports = {
  async up(db) {
    const sessionCollection = db.collection('sessions');

    // Invalidate existing sessions. Users must sign in again.
    await sessionCollection.updateMany(
      {},
      {
        $set: { isValid: false },
        $unset: { refreshToken: '' },
      },
    );

    // Delete existing sessions missing tokenHash to prevent duplicate key errors on unique index
    await sessionCollection.deleteMany({ tokenHash: { $exists: false } });

    // Drop legacy index on refreshToken if present
    const indexes = await sessionCollection.indexes();
    const oldRefreshTokenIndex = indexes.find(
      (idx) => idx.name === 'refreshToken_1' || idx.key.refreshToken,
    );

    if (oldRefreshTokenIndex) {
      try {
        await sessionCollection.dropIndex(oldRefreshTokenIndex.name);
      } catch (error) {
        console.warn(`Failed to drop refreshToken index: ${error.message}`);
      }
    }

    // Create unique index on tokenHash
    const tokenHashIndexExists = indexes.some(
      (idx) =>
        idx.name === 'tokenHash_1' ||
        idx.name === 'tokenHash_unique' ||
        idx.key.tokenHash,
    );

    if (!tokenHashIndexExists) {
      await sessionCollection.createIndex(
        { tokenHash: 1 },
        {
          unique: true,
          name: 'tokenHash_unique',
        },
      );
    }
  },

  async down(db) {
    const sessionCollection = db.collection('sessions');

    try {
      await sessionCollection.dropIndex('tokenHash_unique');
    } catch {
      try {
        await sessionCollection.dropIndex('tokenHash_1');
      } catch (error) {
        console.warn(`Failed to drop tokenHash index: ${error.message}`);
      }
    }

    try {
      await sessionCollection.createIndex(
        { refreshToken: 1 },
        {
          unique: true,
          name: 'refreshToken_1',
          sparse: true,
        },
      );
    } catch (error) {
      console.warn(`Failed to recreate refreshToken index: ${error.message}`);
    }
  },
};
