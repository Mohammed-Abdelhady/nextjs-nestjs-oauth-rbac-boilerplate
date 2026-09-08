import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { MagicLinkService } from './magic-link.service';
import { PendingMagicLink } from './schemas/pending-magic-link.schema';
import { AuthMailService } from '../services/auth-mail.service';
import { SignInService } from '../services/sign-in.service';
import { User } from '../../user/schemas/user.schema';
import { AuthProvider } from '../../user/enums/auth-provider.enum';

/**
 * Shared setup for the MagicLinkService specs.
 * The file ends in -spec.ts rather than .spec.ts: the build excludes it and
 * jest does not collect it as a suite of its own.
 */

export interface MagicLinkHarness {
  service: MagicLinkService;
  pendingModel: {
    create: jest.Mock;
    countDocuments: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  userModel: { findOne: jest.Mock; create: jest.Mock };
  authMailService: { sendMagicLink: jest.Mock };
  signInService: { completeSignIn: jest.Mock; issueSession: jest.Mock };
}

export const MAGIC_LINK_EXPIRES_IN = 900000;
export const MAGIC_LINK_MAX_PER_HOUR = 5;

export const MOCK_USER = {
  _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
  email: 'user@example.com',
  name: 'Test User',
  role: 'user',
  permissions: [],
  authProvider: AuthProvider.EMAIL,
  isVerified: true,
  isDeleted: false,
  save: jest.fn().mockResolvedValue(undefined),
};

/** Summary a finished sign-in hands back, as SignInService would build it. */
export const MOCK_USER_SUMMARY = {
  id: '507f1f77bcf86cd799439011',
  email: 'user@example.com',
  name: 'Test User',
  role: 'user',
  authProvider: AuthProvider.EMAIL,
  isVerified: true,
  permissions: ['read'],
};

export const MOCK_REQUEST = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'test-agent' },
} as unknown as Request;

export const MOCK_RESPONSE = {
  req: {
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1',
  },
  cookie: jest.fn(),
} as unknown as Response;

const CONFIG_VALUES: Record<string, string | number> = {
  'magicLink.expiresIn': MAGIC_LINK_EXPIRES_IN,
  'magicLink.maxPerHour': MAGIC_LINK_MAX_PER_HOUR,
  'cors.clientUrl': 'http://localhost:3000',
};

export async function createMagicLinkHarness(): Promise<MagicLinkHarness> {
  const pendingModel = {
    create: jest.fn().mockResolvedValue(undefined),
    countDocuments: jest.fn().mockResolvedValue(0),
    findOneAndUpdate: jest.fn(),
  };

  const userModel = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(MOCK_USER),
  };

  const configService = {
    get: jest.fn((key: string, defaultValue?: string | number) =>
      key in CONFIG_VALUES ? CONFIG_VALUES[key] : defaultValue,
    ),
  } as unknown as ConfigService;

  const authMailService = {
    sendMagicLink: jest.fn().mockResolvedValue(undefined),
  };

  const signInService = {
    completeSignIn: jest
      .fn()
      .mockResolvedValue({ requiresTwoFactor: false, user: MOCK_USER_SUMMARY }),
    issueSession: jest.fn().mockResolvedValue(MOCK_USER_SUMMARY),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MagicLinkService,
      {
        provide: getModelToken(PendingMagicLink.name),
        useValue: pendingModel,
      },
      { provide: getModelToken(User.name), useValue: userModel },
      { provide: ConfigService, useValue: configService },
      { provide: AuthMailService, useValue: authMailService },
      { provide: SignInService, useValue: signInService },
    ],
  }).compile();

  return {
    service: module.get<MagicLinkService>(MagicLinkService),
    pendingModel,
    userModel,
    authMailService,
    signInService,
  };
}
