import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthService } from './auth.service';
import { HashService } from '../common/services/hash.service';
import { MailService } from '../mail/mail.service';
import { SessionService } from './services/session.service';
import { VerificationCodeService } from './services/verification-code.service';
import { User } from '../user/schemas/user.schema';
import { Role } from '../role/schemas/role.schema';
import { ErrorCode } from '../common/enums/error-code.enum';
import { AuthProvider } from '../user/enums/auth-provider.enum';

describe('AuthService', () => {
  let service: AuthService;
  let userModel: {
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let roleModel: {
    findOne: jest.Mock;
  };
  let hashService: {
    hash: jest.Mock;
    compare: jest.Mock;
  };
  let mailService: {
    sendActivationCode: jest.Mock;
    sendPasswordResetCode: jest.Mock;
  };
  let sessionService: {
    createSession: jest.Mock;
    invalidateSession: jest.Mock;
    invalidateAllSessions: jest.Mock;
  };
  let verificationCodeService: {
    createOrUpdatePendingRegistration: jest.Mock;
    verifyAndConsumeRegistration: jest.Mock;
    resendActivationCode: jest.Mock;
    createOrUpdatePasswordReset: jest.Mock;
    verifyPasswordReset: jest.Mock;
    clearPasswordReset: jest.Mock;
  };

  const mockUserId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const mockUser = {
    _id: mockUserId,
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

  const mockResponse = {
    req: {
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
    },
    cookie: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    userModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    };

    roleModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ slug: 'user', permissions: ['read'] }),
      }),
    };

    hashService = {
      hash: jest.fn().mockResolvedValue('hashed-val'),
      compare: jest.fn().mockResolvedValue(true),
    };

    mailService = {
      sendActivationCode: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
    };

    sessionService = {
      createSession: jest.fn().mockResolvedValue('session-token-123'),
      invalidateSession: jest.fn().mockResolvedValue(true),
      invalidateAllSessions: jest.fn().mockResolvedValue(2),
    };

    verificationCodeService = {
      createOrUpdatePendingRegistration: jest.fn().mockResolvedValue('123456'),
      verifyAndConsumeRegistration: jest.fn().mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
        hashedPassword: 'hashed-password',
      }),
      resendActivationCode: jest.fn().mockResolvedValue({
        code: '654321',
        name: 'Test User',
      }),
      createOrUpdatePasswordReset: jest.fn().mockResolvedValue('123456'),
      verifyPasswordReset: jest.fn().mockResolvedValue(undefined),
      clearPasswordReset: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      get: jest.fn((key: string, defaultValue?: string | number) => {
        const defaults: Record<string, string | number> = {
          'session.cookieName': 'sid',
          'session.cookieMaxAge': 604800000,
          NODE_ENV: 'test',
        };
        return defaults[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: HashService, useValue: hashService },
        { provide: MailService, useValue: mailService },
        { provide: SessionService, useValue: sessionService },
        { provide: VerificationCodeService, useValue: verificationCodeService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login (S-01 and D-04)', () => {
    it('should reject login with 401 when user is deleted', async () => {
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.login(
          { email: 'deleted@example.com', password: 'Password123!' },
          mockResponse,
        ),
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CREDENTIALS,
        status: 401,
      });

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'deleted@example.com',
        isDeleted: { $ne: true },
      });
      expect(hashService.compare).not.toHaveBeenCalled();
    });

    it('should reject login with 401 when account has no password (OAuth-only)', async () => {
      const oauthUser = {
        ...mockUser,
        password: undefined,
      };
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(oauthUser),
      });

      await expect(
        service.login(
          { email: 'oauth@example.com', password: 'Password123!' },
          mockResponse,
        ),
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CREDENTIALS,
        status: 401,
      });

      expect(hashService.compare).not.toHaveBeenCalled();
    });

    it('should authenticate user and create session on valid credentials', async () => {
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      hashService.compare.mockResolvedValue(true);

      const result = await service.login(
        { email: 'user@example.com', password: 'Password123!' },
        mockResponse,
      );

      expect(result.success).toBe(true);
      expect(sessionService.createSession).toHaveBeenCalledWith(
        mockUserId,
        'test-agent',
        '127.0.0.1',
      );
    });
  });

  describe('password reset (S-01 and S-07)', () => {
    it('should reject forgotPassword with 404 when user is deleted', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.forgotPassword({ email: 'deleted@example.com' }),
      ).rejects.toMatchObject({
        code: ErrorCode.USER_NOT_FOUND_FOR_RESET,
        status: 404,
      });

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'deleted@example.com',
        isDeleted: { $ne: true },
      });
    });

    it('should invalidate all sessions on successful resetPassword', async () => {
      userModel.findOne.mockResolvedValue(mockUser);
      hashService.hash.mockResolvedValue('new-hashed-password');

      const result = await service.resetPassword({
        email: 'user@example.com',
        code: '123456',
        newPassword: 'NewPassword123!',
      });

      expect(result.success).toBe(true);
      expect(sessionService.invalidateAllSessions).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(verificationCodeService.clearPasswordReset).toHaveBeenCalledWith(
        'user@example.com',
      );
    });
  });

  describe('resendActivation (S-01)', () => {
    it('should reject resendActivation when user already exists', async () => {
      userModel.findOne.mockResolvedValue(mockUser);

      await expect(
        service.resendActivation({ email: 'user@example.com' }),
      ).rejects.toMatchObject({
        code: ErrorCode.NO_PENDING_REGISTRATION_FOR_RESEND,
        status: 404,
      });

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'user@example.com',
        isDeleted: { $ne: true },
      });
    });
  });
});
