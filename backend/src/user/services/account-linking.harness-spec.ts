import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AccountLinkingService } from './account-linking.service';
import { User } from '../schemas/user.schema';
import { EMAIL_PROVIDER } from '../../common/constants/oauth-providers';
import { OAuthProfile } from '../../auth/oauth/oauth-provider.interface';
import { MONGO_LINKED_ACCOUNT_STORE } from '../persistence/mongo/mongo-linked-account-stores';
import { MONGO_SIGN_IN_METHOD_STORE } from '../persistence/mongo/mongo-account-stores';
import { Passkey } from '../../auth/passkeys/schemas/passkey.schema'; // feature:passkeys
import { UnitOfWorkRunner } from '../../common/persistence/unit-of-work';
import { MongoUnitOfWorkRunner } from '../../session/persistence/mongo/mongo-unit-of-work';
import { createModelMock } from '../../common/testing/test-doubles.harness-spec';
import { SignInMethodRule } from './sign-in-method.rule';
import { ConfigService } from '@nestjs/config';
import { AuthFeaturesService } from '../../auth/services/features/auth-features.service';

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
  const userModel = {
    findById: jest.fn(),
    // The fence every unlink passes.
    updateOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    }),
  };
  // feature:passkeys:start
  const passkeyModel = {
    countDocuments: jest.fn().mockReturnValue({
      session: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(0),
    }),
  };
  // feature:passkeys:end
  // A driver session whose transaction commits.
  const session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
    inTransaction: jest.fn().mockReturnValue(true),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AccountLinkingService,
      MONGO_LINKED_ACCOUNT_STORE,
      SignInMethodRule,
      MONGO_SIGN_IN_METHOD_STORE,
      // The switches at their defaults: password sign-in on, magic links off.
      {
        provide: AuthFeaturesService,
        useValue: new AuthFeaturesService(new ConfigService()),
      },
      {
        provide: UnitOfWorkRunner,
        useValue: new MongoUnitOfWorkRunner(
          createModelMock<
            ConstructorParameters<typeof MongoUnitOfWorkRunner>[0]
          >({ startSession: jest.fn().mockResolvedValue(session) }),
        ),
      },
      { provide: getModelToken(User.name), useValue: userModel },
      { provide: getModelToken(Passkey.name), useValue: passkeyModel }, // feature:passkeys
    ],
  }).compile();

  return {
    service: module.get<AccountLinkingService>(AccountLinkingService),
    resolveUser: (user: MockUser | null) => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(user),
      });
    },
  };
}
