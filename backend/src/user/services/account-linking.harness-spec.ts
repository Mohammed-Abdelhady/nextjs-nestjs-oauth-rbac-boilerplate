import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AccountLinkingService } from './account-linking.service';
import { User } from '../schemas/user.schema';
import { EMAIL_PROVIDER } from '../../common/constants/oauth-providers';
import { OAuthProfile } from '../../auth/oauth/oauth-provider.interface';

/**
 * Shared setup for the AccountLinkingService specs.
 * The file ends in -spec.ts rather than .spec.ts: the build excludes it and
 * jest does not collect it as a suite of its own.
 */

export interface LinkedAccount {
  provider: string;
  providerId: string;
  linkedAt: Date;
}

export interface MockUser {
  _id: Types.ObjectId;
  email: string;
  isDeleted: boolean;
  authProvider: string;
  primaryProvider?: string;
  linkedAccounts: LinkedAccount[];
  linkedProviders: string[];
  save: jest.Mock;
}

export interface AccountLinkingHarness {
  service: AccountLinkingService;
  /** Makes findById resolve to this user, for both the plain and select paths. */
  resolveUser: (user: MockUser | null) => void;
}

export const USER_ID = new Types.ObjectId().toString();

export const GOOGLE_PROFILE: OAuthProfile = {
  providerId: 'google-123',
  email: 'user@example.com',
  emailVerified: true,
  name: 'Test User',
};

/** Builds a user whose linkedProviders virtual matches its linkedAccounts. */
export function buildUser(overrides: Partial<MockUser> = {}): MockUser {
  const linkedAccounts = overrides.linkedAccounts ?? [];

  return {
    _id: new Types.ObjectId(USER_ID),
    email: 'user@example.com',
    isDeleted: false,
    authProvider: EMAIL_PROVIDER,
    linkedAccounts,
    linkedProviders: [
      EMAIL_PROVIDER,
      ...linkedAccounts.map((account) => account.provider),
    ],
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

export function linkedAccount(provider: string): LinkedAccount {
  return {
    provider,
    providerId: `${provider}-1`,
    linkedAt: new Date(),
  };
}

export async function createHarness(): Promise<AccountLinkingHarness> {
  const userModel = { findById: jest.fn() };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AccountLinkingService,
      { provide: getModelToken(User.name), useValue: userModel },
    ],
  }).compile();

  return {
    service: module.get<AccountLinkingService>(AccountLinkingService),
    resolveUser: (user: MockUser | null) => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(user),
      });
    },
  };
}
