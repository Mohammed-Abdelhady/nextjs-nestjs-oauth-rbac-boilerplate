/**
 * Migration: Registration binding
 *
 * The old contract kept a password hash on a pending sign-up, so the first
 * registrant chose the password of the account its owner later confirmed.
 * Deploying the new contract deletes every pending sign-up record (they carry
 * hashedPassword); their hashes are never used. Pending address confirmations
 * (no hashedPassword) are bound to the account they belong to when that
 * account still exists and is still unverified, otherwise they are dropped and
 * an admin can re-issue the change.
 *
 * The pending registration index moves from unique email to unique
 * email + purpose, so a sign-up and an email change can coexist.
 *
 * Down cannot restore records that were deleted, and reverting the index would
 * reopen the pre-hijack window, so it leaves the data as the new contract
 * requires.
 *
 * Deploy: run `migration:up` before the new server starts. Migrations are not
 * wired into boot (the Dockerfile runs `node dist/main`), so until the
 * migration has run a legacy record could still hold the old unique email
 * index. `verification-code.service.ts` tolerates that: on a duplicate key it
 * drops a legacy record (one with no purpose) and retries, so registration
 * cannot answer 500 for that one address before the index is replaced.
 */

const {
  dropIndexIfExists,
} = require('../migration-support/migration-index-utils');

const COLLECTION = 'pendingregistrations';
const OLD_EMAIL_INDEX = 'email_1';
const PURPOSE_INDEX = 'email_1_purpose_1';
const PURPOSE_EMAIL_CHANGE = 'email-change';

module.exports = {
  async up(db) {
    const pending = db.collection(COLLECTION);

    const deletedSignups = await pending.deleteMany({
      hashedPassword: { $exists: true },
    });
    console.log(`Deleted ${deletedSignups.deletedCount} old pending sign-ups`);

    const legacy = pending.find({
      hashedPassword: { $exists: false },
      purpose: { $exists: false },
    });
    let converted = 0;
    let dropped = 0;
    while (await legacy.hasNext()) {
      const record = await legacy.next();
      if (!record) continue;

      const user = await db.collection('users').findOne({
        email: record.email,
        isDeleted: { $ne: true },
      });

      if (user && user.isVerified !== true) {
        await pending.updateOne(
          { _id: record._id },
          {
            $set: {
              purpose: PURPOSE_EMAIL_CHANGE,
              userId: user._id,
              addressGeneration: user.addressGeneration || 0,
            },
          },
        );
        converted += 1;
      } else {
        await pending.deleteOne({ _id: record._id });
        dropped += 1;
      }
    }
    console.log(
      `Converted ${converted} pending address confirmations, dropped ${dropped}`,
    );

    // Create the replacement index before dropping the old one, so a failure
    // here leaves the collection with its unique email index rather than none.
    await pending.createIndex(
      { email: 1, purpose: 1 },
      { unique: true, name: PURPOSE_INDEX },
    );
    await dropIndexIfExists(pending, OLD_EMAIL_INDEX);
  },

  async down() {
    // Deleted records cannot be restored, and the new index is what keeps a
    // sign-up and an email change from overwriting each other.
  },
};
