import { ConfigService } from '@nestjs/config';
import { AccountsContractHarness } from '../../../test/utils/user/accounts-contract/accounts-contract-harness';
import { ACCOUNTS_CONTRACT_CASE_TIMEOUT_MS } from '../../../test/utils/user/accounts-contract/accounts-contract-harness';
import { OAuthProfile } from '../../auth/oauth/oauth-provider.interface';
import { AccountLinkingService } from '../services/account-linking.service';
import { ProfileSyncService } from '../services/profile-sync.service';
import { LinkedAccountStore } from '../stores/linked-account.store';

export interface StoredLink {
  provider: string;
  providerId: string;
}

export interface StoredSyncFacts {
  name: string;
  avatarUrl: string | null;
  primaryProvider: string | null;
  lastSyncedProvider: string | null;
  profileSyncedAt: Date | null;
}

/** The accounts harness, plus what the linked-account cases need of a database. */
export interface LinkedAccountsContractHarness extends AccountsContractHarness {
  readonly links: LinkedAccountStore;
  /** The links an account has, in the order they were made. */
  storedLinks(userId: string): Promise<StoredLink[]>;
  syncFacts(userId: string): Promise<StoredSyncFacts | null>;
  /** Sets when an account was last synced, committed, around the adapters. */
  markSynced(userId: string, at: Date | null): Promise<void>;
}

export type LinkedHarnessSource = () => LinkedAccountsContractHarness;

export interface LinkedFixture {
  ownerId: string;
  otherId: string;
}

export const OWNER_EMAIL = 'owner@example.test';

export function profileOf(
  providerId: string,
  overrides: Partial<OAuthProfile> = {},
): OAuthProfile {
  return {
    providerId,
    email: OWNER_EMAIL,
    emailVerified: true,
    name: 'Provider Name',
    ...overrides,
  };
}

export interface LinkedServices {
  linking: AccountLinkingService;
  sync: ProfileSyncService;
}

/** The real services on this database's adapter. */
export function linkedServicesOn(
  harness: LinkedAccountsContractHarness,
): LinkedServices {
  return {
    linking: new AccountLinkingService(harness.links),
    sync: new ProfileSyncService(
      harness.links,
      new ConfigService({ profileSync: { fields: 'name,picture' } }),
    ),
  };
}

export async function seedLinkedFixture(
  harness: LinkedAccountsContractHarness,
): Promise<LinkedFixture> {
  await harness.seedRole({
    name: 'User',
    slug: 'user',
    level: 1,
    permissions: [],
  });
  return {
    ownerId: await harness.seedAccount({
      email: OWNER_EMAIL,
      name: 'Owner',
      role: 'user',
    }),
    otherId: await harness.seedAccount({
      email: 'other@example.test',
      name: 'Other',
      role: 'user',
    }),
  };
}

/** A contract case with the budget a database case gets. */
export function linkedCase(name: string, body: () => Promise<void>): void {
  it(name, body, ACCOUNTS_CONTRACT_CASE_TIMEOUT_MS);
}
