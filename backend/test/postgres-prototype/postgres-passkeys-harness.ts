import { randomUUID } from 'node:crypto';
import {
  byCredentialId,
  PasskeysContractHarness,
} from '../../src/auth/passkeys/contract/passkeys-contract.harness-spec';
import { FrozenClock, TEST_NOW } from '../utils/frozen-clock';
import { PostgresAccountProfileStore } from './adapter/postgres-account-profile.store';
import { PostgresIdFormat } from './adapter/postgres-id-format';
import { PostgresPasskeyChallengeStore } from './adapter/postgres-passkey-challenge.store';
import {
  PostgresPasskeyAccounts,
  PostgresPasskeyStore,
} from './adapter/postgres-passkey.store';
import { PostgresUnitOfWorkRunner } from './adapter/postgres-unit-of-work';
import { openPrototypeConnection } from './postgres-connection';

const AN_OBJECT_ID = '65f000000000000000000001';

export async function bootPostgresPasskeysHarness(): Promise<PasskeysContractHarness> {
  const connection = await openPrototypeConnection();
  const { database } = connection;
  const clock = new FrozenClock(TEST_NOW);
  const profiles = new PostgresAccountProfileStore(database, clock);

  return {
    clock,
    passkeys: new PostgresPasskeyStore(database, clock),
    challenges: new PostgresPasskeyChallengeStore(database),
    accounts: new PostgresPasskeyAccounts(database),
    runner: (pause) => new PostgresUnitOfWorkRunner(database, pause),

    profilePasskeyCount: (userId) => profiles.countPasskeys(userId),

    seedAccount: async (account) => {
      const row = await database
        .insertInto('users')
        .values({
          email: account.email,
          name: 'Contract Tester',
          password_hash: account.passwordHash ?? null,
          is_verified: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      if (account.linked) {
        await database
          .insertInto('user_linked_accounts')
          .values({
            user_id: row.id,
            provider: 'google',
            provider_id: `google-${account.email}`,
            linked_at: TEST_NOW,
          })
          .execute();
      }
      return row.id;
    },
    setDeleted: async (userId, deleted) => {
      await database
        .updateTable('users')
        .set({ is_deleted: deleted })
        .where('id', '=', userId)
        .execute();
    },
    removeAccount: async (userId) => {
      await database.deleteFrom('users').where('id', '=', userId).execute();
    },

    seedPasskey: async (passkey) => {
      const row = await database
        .insertInto('passkeys')
        .values({
          user_id: passkey.userId,
          credential_id: passkey.credentialId,
          public_key: Buffer.from([7, 7, 7]),
          counter: passkey.counter ?? 0,
          transports: ['internal'],
          device_type: 'singleDevice',
          backed_up: false,
          name: passkey.name ?? 'Seeded key',
          last_used_at: null,
          created_at: passkey.createdAt,
          updated_at: passkey.createdAt,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return row.id;
    },
    storedPasskeys: async () => {
      const rows = await database.selectFrom('passkeys').selectAll().execute();
      return rows
        .map((row) => ({
          id: row.id,
          userId: row.user_id,
          credentialId: row.credential_id,
          publicKey: row.public_key,
          counter: Number.parseInt(row.counter, 10),
          transports: row.transports,
          deviceType: row.device_type,
          backedUp: row.backed_up,
          name: row.name,
          lastUsedAt: row.last_used_at,
        }))
        .sort(byCredentialId);
    },

    seedChallenge: async (challenge) => {
      await database
        .insertInto('passkey_challenges')
        .values({
          challenge_hash: challenge.challengeHash,
          purpose: challenge.purpose,
          user_id: null,
          expires_at: challenge.expiresAt,
        })
        .execute();
    },
    setChallengeExpiry: async (challengeHash, expiresAt) => {
      await database
        .updateTable('passkey_challenges')
        .set({ expires_at: expiresAt })
        .where('challenge_hash', '=', challengeHash)
        .execute();
    },
    storedChallenges: async () => {
      const rows = await database
        .selectFrom('passkey_challenges')
        .selectAll()
        .orderBy('challenge_hash')
        .execute();
      return rows.map((row) => ({
        challengeHash: row.challenge_hash,
        purpose: row.purpose,
        userId: row.user_id,
        expiresAt: row.expires_at,
      }));
    },

    ids: new PostgresIdFormat(),
    absentId: () => randomUUID(),
    foreignId: () => AN_OBJECT_ID,

    reset: connection.reset,
    close: connection.close,
  };
}
