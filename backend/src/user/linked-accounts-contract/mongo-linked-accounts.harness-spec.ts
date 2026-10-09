import { Types } from 'mongoose';
import { bootMongoAccountsHarness } from '../../../test/utils/user/accounts-contract/mongo-accounts-harness';
import { MongoLinkedAccountStore } from '../persistence/mongo/mongo-linked-account.store';
import { LinkedAccountsContractHarness } from './linked-accounts-contract.harness-spec';

export async function bootMongoLinkedAccountsHarness(): Promise<LinkedAccountsContractHarness> {
  const accounts = await bootMongoAccountsHarness();
  const { users } = accounts.booted;

  return Object.assign(accounts, {
    links: new MongoLinkedAccountStore(users),
    storedLinks: async (userId: string) => {
      const user = await users.findById(userId).lean().exec();
      return (user?.linkedAccounts ?? []).map((linked) => ({
        provider: linked.provider,
        providerId: linked.providerId,
      }));
    },
    syncFacts: async (userId: string) => {
      const user = await users.findById(userId).lean().exec();
      if (!user) return null;
      return {
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        primaryProvider: user.primaryProvider ?? null,
        lastSyncedProvider: user.lastSyncedProvider ?? null,
        profileSyncedAt: user.profileSyncedAt ?? null,
      };
    },
    markSynced: async (userId: string, at: Date | null) => {
      await users.updateOne(
        { _id: new Types.ObjectId(userId) },
        at
          ? { $set: { profileSyncedAt: at } }
          : { $unset: { profileSyncedAt: 1 } },
      );
    },
  });
}
