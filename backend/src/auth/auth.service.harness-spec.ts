import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthService } from './auth.service';
import { HashService } from '../common/services/hash.service';
import { AuthMailService } from './services/auth-mail.service';
import { SessionService } from './services/session.service';
import { SessionCookieService } from './services/session-cookie.service';
import { VerificationCodeService } from './services/verification-code.service';
import { PasswordResetCodeService } from './services/password-reset-code.service';
import { User } from '../user/schemas/user.schema';
import { Role } from '../role/schemas/role.schema';
import { AuthProvider } from '../user/enums/auth-provider.enum';

/**
 * Shared setup for the AuthService specs.
 * The file ends in -spec.ts rather than .spec.ts: the build excludes it and
 * jest does not collect it as a suite of its own.
 */

export interface AuthServiceHarness {
  service: AuthService;
  userModel: { findOne: jest.Mock; create: jest.Mock };
  roleModel: { findOne: jest.Mock };
  hashService: { hash: jest.Mock; compare: jest.Mock };
  authMailService: {
    sendActivationCode: jest.Mock;
    sendPasswordResetCode: jest.Mock;
    sendRegistrationAttemptNotice: jest.Mock;
  };
  sessionService: {
    createSession: jest.Mock;
    invalidateSession: jest.Mock;
    invalidateAllSessions: jest.Mock;
  };
  verificationCodeService: {
    createOrUpdatePendingRegistration: jest.Mock;
    verifyAndConsumeRegistration: jest.Mock;
    resendActivationCode: jest.Mock;
  };
  passwordResetCodeService: {
    createOrUpdatePasswordReset: jest.Mock;
    verifyPasswordReset: jest.Mock;
    clearPasswordReset: jest.Mock;
  };
  sessionCookieService: { set: jest.Mock; clear: jest.Mock; read: jest.Mock };
}

export const MOCK_USER_ID = new Types.ObjectId('507f1f77bcf86cd799439011');

export const MOCK_USER = {
  _id: MOCK_USER_ID,
  email: 'user@example.com',
  name: 'Test User',
  password: 'hashed-password',
  role: 'user',
  permissions: [],
  authProvider: AuthProvider.EMAIL,
  isVerified: true,
  isDeleted: false,
  save: jest.fn().mockResolvedValue(undefined),
};

export const REGISTER_DTO = {
  email: 'user@example.com',
  password: 'Password123!',
  name: 'Test User',
};

export const MOCK_RESPONSE = {
  req: {
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1',
  },
  cookie: jest.fn(),
} as unknown as Response;

export async function createAuthServiceHarness(): Promise<AuthServiceHarness> {
  const userModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const roleModel = {
    findOne: jest.fn().mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ slug: 'user', permissions: ['read'] }),
    }),
  };

  const hashService = {
    hash: jest.fn().mockResolvedValue('hashed-val'),
    compare: jest.fn().mockResolvedValue(true),
  };

  const authMailService = {
    sendActivationCode: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
    sendRegistrationAttemptNotice: jest.fn().mockResolvedValue(undefined),
  };

  const sessionService = {
    createSession: jest.fn().mockResolvedValue('session-token-123'),
    invalidateSession: jest.fn().mockResolvedValue(true),
    invalidateAllSessions: jest.fn().mockResolvedValue(2),
  };

  const verificationCodeService = {
    createOrUpdatePendingRegistration: jest
      .fn()
      .mockResolvedValue({ code: '123456', name: 'Test User' }),
    verifyAndConsumeRegistration: jest.fn().mockResolvedValue({
      email: 'user@example.com',
      name: 'Test User',
      hashedPassword: 'hashed-password',
    }),
    resendActivationCode: jest
      .fn()
      .mockResolvedValue({ code: '654321', name: 'Test User' }),
  };

  const passwordResetCodeService = {
    createOrUpdatePasswordReset: jest.fn().mockResolvedValue('123456'),
    verifyPasswordReset: jest.fn().mockResolvedValue(undefined),
    clearPasswordReset: jest.fn().mockResolvedValue(undefined),
  };

  const sessionCookieService = {
    set: jest.fn(),
    clear: jest.fn(),
    read: jest.fn(),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getModelToken(User.name), useValue: userModel },
      { provide: getModelToken(Role.name), useValue: roleModel },
      { provide: HashService, useValue: hashService },
      { provide: AuthMailService, useValue: authMailService },
      { provide: SessionService, useValue: sessionService },
      { provide: VerificationCodeService, useValue: verificationCodeService },
      { provide: PasswordResetCodeService, useValue: passwordResetCodeService },
      { provide: SessionCookieService, useValue: sessionCookieService },
    ],
  }).compile();

  return {
    service: module.get<AuthService>(AuthService),
    userModel,
    roleModel,
    hashService,
    authMailService,
    sessionService,
    verificationCodeService,
    passwordResetCodeService,
    sessionCookieService,
  };
}
