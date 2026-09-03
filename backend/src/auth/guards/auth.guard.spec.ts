import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuthGuard } from './auth.guard';
import { SessionService } from '../services/session.service';
import { Role } from '../../role/schemas/role.schema';
import { ErrorCode } from '../../common/enums/error-code.enum';

describe('AuthGuard (S-01)', () => {
  let guard: AuthGuard;
  let sessionService: {
    validateSession: jest.Mock;
  };
  let roleModel: {
    findOne: jest.Mock;
  };

  const createMockContext = (
    cookies: Record<string, string> = {},
  ): ExecutionContext => {
    const request = {
      cookies,
      user: undefined,
      session: undefined,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    sessionService = {
      validateSession: jest.fn(),
    };

    roleModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ slug: 'user', permissions: ['read'] }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: SessionService, useValue: sessionService },
        { provide: getModelToken(Role.name), useValue: roleModel },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  it('should throw SESSION_REQUIRED when cookie is missing', async () => {
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.SESSION_REQUIRED,
      status: 401,
    });
  });

  it('should throw SESSION_INVALID when validateSession returns null', async () => {
    const context = createMockContext({ sid: 'invalid-token' });
    sessionService.validateSession.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.SESSION_INVALID,
      status: 401,
    });
  });

  it('should throw SESSION_INVALID when populated user is missing', async () => {
    const context = createMockContext({ sid: 'valid-token' });
    sessionService.validateSession.mockResolvedValue({
      user: null,
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.SESSION_INVALID,
      status: 401,
    });
  });

  it('should throw SESSION_INVALID when user isDeleted', async () => {
    const context = createMockContext({ sid: 'valid-token' });
    sessionService.validateSession.mockResolvedValue({
      user: {
        _id: new Types.ObjectId(),
        email: 'deleted@example.com',
        isDeleted: true,
      },
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.SESSION_INVALID,
      status: 401,
    });
  });

  it('should allow access when user is active', async () => {
    const context = createMockContext({ sid: 'valid-token' });
    const userDoc = {
      _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'active@example.com',
      name: 'Active User',
      role: 'user',
      permissions: ['custom:perm'],
      isVerified: true,
      isDeleted: false,
    };
    const sessionDoc = { user: userDoc };

    sessionService.validateSession.mockResolvedValue(sessionDoc);

    const allowed = await guard.canActivate(context);
    expect(allowed).toBe(true);
  });
});
