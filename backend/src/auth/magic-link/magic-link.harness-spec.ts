import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { MagicLinkService } from './magic-link.service';
import { PendingMagicLink } from './schemas/pending-magic-link.schema';
import { AuthMailService } from '../services/auth-mail.service';
import { SessionService } from '../services/session.service';
import { SessionCookieService } from '../services/session-cookie.service';
import { User } from '../../user/schemas/user.schema';
import { Role } from '../../role/schemas/role.schema';
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
  sessionService: { createSession: jest.Mock };
  sessionCookieService: { set: jest.Mock };
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

  const roleModel = {
    findOne: jest.fn().mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ slug: 'user', permissions: ['read'] }),
    }),
  };

  const configService = {
    get: jest.fn((key: string, defaultValue?: string | number) =>
      key in CONFIG_VALUES ? CONFIG_VALUES[key] : defaultValue,
    ),
  } as unknown as ConfigService;

  const authMailService = {
    sendMagicLink: jest.fn().mockResolvedValue(undefined),
  };

  const sessionService = {
    createSession: jest.fn().mockResolvedValue('session-token-123'),
  };

  const sessionCookieService = { set: jest.fn() };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MagicLinkService,
      {
        provide: getModelToken(PendingMagicLink.name),
        useValue: pendingModel,
      },
      { provide: getModelToken(User.name), useValue: userModel },
      { provide: getModelToken(Role.name), useValue: roleModel },
      { provide: ConfigService, useValue: configService },
      { provide: AuthMailService, useValue: authMailService },
      { provide: SessionService, useValue: sessionService },
      { provide: SessionCookieService, useValue: sessionCookieService },
    ],
  }).compile();

  return {
    service: module.get<MagicLinkService>(MagicLinkService),
    pendingModel,
    userModel,
    authMailService,
    sessionService,
    sessionCookieService,
  };
}
