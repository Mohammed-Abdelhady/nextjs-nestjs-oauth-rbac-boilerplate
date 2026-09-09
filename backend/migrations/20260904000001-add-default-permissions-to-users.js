/**
 * Migration: Add Default Permissions to Users
 *
 * Populates default permissions for users missing a permissions array or
 * possessing an empty array, based on their assigned role.
 * Iterates with a cursor in batches of 500 using bulkWrite.
 * Down migration removes only the exact permission strings this run assigned,
 * identified by migrationMarkers.defaultPermissions20260904.
 */

const DEFAULT_ROLE_PERMISSIONS = {
  user: ['profile:read:own', 'profile:update:own'],
  support: [
    'profile:read:own',
    'profile:update:own',
    'users:read:all',
    'sessions:read:all',
  ],
  manager: [
    'profile:read:own',
    'profile:update:own',
    'users:read:all',
    'users:update:all',
    'sessions:read:all',
    'roles:read:all',
  ],
  admin: ['*'],
};

const BATCH_SIZE = 500;
const OWNERSHIP_MARKER = 'migrationMarkers.defaultPermissions20260904';

module.exports = {
  async up(db) {
    const usersCollection = db.collection('users');
    const cursor = usersCollection.find({
      $or: [{ permissions: { $exists: false } }, { permissions: { $size: 0 } }],
    });

    let bulkOps = [];
    let updatedCount = 0;

    while (await cursor.hasNext()) {
      const user = await cursor.next();
      if (!user) {
        continue;
      }

      const roleSlug = (user.role || '').toLowerCase();
      const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[roleSlug];

      if (!defaultPermissions || defaultPermissions.length === 0) {
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              permissions: [...defaultPermissions],
              [OWNERSHIP_MARKER]: true,
            },
          },
        },
      });

      if (bulkOps.length >= BATCH_SIZE) {
        const result = await usersCollection.bulkWrite(bulkOps);
        updatedCount += result.modifiedCount;
        bulkOps = [];
      }
    }

    if (bulkOps.length > 0) {
      const result = await usersCollection.bulkWrite(bulkOps);
      updatedCount += result.modifiedCount;
    }

    console.log(`Updated permissions for ${updatedCount} users`);
  },

  async down(db) {
    const usersCollection = db.collection('users');
    const cursor = usersCollection.find({
      [OWNERSHIP_MARKER]: true,
    });

    let bulkOps = [];
    let rolledBackCount = 0;

    while (await cursor.hasNext()) {
      const user = await cursor.next();
      if (!user) {
        continue;
      }

      const roleSlug = (user.role || '').toLowerCase();
      const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[roleSlug];

      if (!defaultPermissions || defaultPermissions.length === 0) {
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: user._id, [OWNERSHIP_MARKER]: true },
          update: {
            $pullAll: { permissions: defaultPermissions },
            $unset: { [OWNERSHIP_MARKER]: '' },
          },
        },
      });

      if (bulkOps.length >= BATCH_SIZE) {
        const result = await usersCollection.bulkWrite(bulkOps);
        rolledBackCount += result.modifiedCount;
        bulkOps = [];
      }
    }

    if (bulkOps.length > 0) {
      const result = await usersCollection.bulkWrite(bulkOps);
      rolledBackCount += result.modifiedCount;
    }

    console.log(`Rolled back permissions for ${rolledBackCount} users`);
  },
};
