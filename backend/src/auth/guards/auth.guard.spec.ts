import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuthGuard } from './auth.guard';
import { SessionService } from '../services/session.service';
import { SessionCookieService } from '../services/session-cookie.service';
import { Public } from '../decorators/public.decorator';
import { Role } from '../../role/schemas/role.schema';
import { ErrorCode } from '../../common/enums/error-code.enum';

class GuardedRoutes {
  @Public()
  openRoute(this: void): void {}

  closedRoute(this: void): void {}
}

describe('AuthGuard (X-13, D-29, S-01, S-21)', () => {
  let guard: AuthGuard;
  let sessionService: {
    validateSession: jest.Mock;
  };
  let sessionCookieService: {
    read: jest.Mock;
  };
  let roleModel: {
    findOne: jest.Mock;
  };

  const createMockContext = (
    cookies: Record<string, string> = {},
    handler: () => void = GuardedRoutes.prototype.closedRoute,
  ): { context: ExecutionContext; request: Record<string, unknown> } => {
    const request = {
      cookies,
      user: undefined,
      session: undefined,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => handler,
      getClass: () => GuardedRoutes,
    } as unknown as ExecutionContext;

    return { context, request };
  };

  beforeEach(async () => {
    sessionService = {
      validateSession: jest.fn(),
    };

    sessionCookieService = {
      read: jest.fn(
        (req: { cookies?: Record<string, string> }) => req.cookies?.sid,
      ),
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
        { provide: SessionCookieService, useValue: sessionCookieService },
        { provide: getModelToken(Role.name), useValue: roleModel },
        Reflector,
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  it('should let a @Public route through without reading the cookie', async () => {
    const { context } = createMockContext(
      {},
      GuardedRoutes.prototype.openRoute,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(sessionCookieService.read).not.toHaveBeenCalled();
    expect(sessionService.validateSession).not.toHaveBeenCalled();
  });

  it('should read cookie via sessionCookieService and throw SESSION_REQUIRED when missing', async () => {
    const { context, request } = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.SESSION_REQUIRED,
      status: 401,
    });

    expect(sessionCookieService.read).toHaveBeenCalledWith(request);
  });

  it('should throw SESSION_INVALID when validateSession returns null', async () => {
    const { context, request } = createMockContext({ sid: 'invalid-token' });
    sessionService.validateSession.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.SESSION_INVALID,
      status: 401,
    });

    expect(sessionCookieService.read).toHaveBeenCalledWith(request);
    expect(sessionService.validateSession).toHaveBeenCalledWith(
      'invalid-token',
    );
  });

  it('should throw SESSION_INVALID when populated user is missing', async () => {
    const { context } = createMockContext({ sid: 'valid-token' });
    sessionService.validateSession.mockResolvedValue({
      user: null,
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.SESSION_INVALID,
      status: 401,
    });
  });

  it('should throw SESSION_INVALID when user isDeleted', async () => {
    const { context } = createMockContext({ sid: 'valid-token' });
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
    const { context } = createMockContext({ sid: 'valid-token' });
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
