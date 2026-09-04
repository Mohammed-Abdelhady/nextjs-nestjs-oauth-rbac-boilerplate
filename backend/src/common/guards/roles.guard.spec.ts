import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../../user/enums/user-role.enum';
import { ErrorCode } from '../enums/error-code.enum';

class RoleRoutes {
  openRoute(this: void): void {}

  @Roles(UserRole.ADMIN)
  adminRoute(this: void): void {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  staffRoute(this: void): void {}
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const createContext = (
    handler: () => void,
    role?: string,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
      getHandler: () => handler,
      getClass: () => RoleRoutes,
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new RolesGuard(new Reflector());
  });

  it('should allow a route that declares no roles', () => {
    const context = createContext(RoleRoutes.prototype.openRoute);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject an unauthenticated request with SESSION_REQUIRED', () => {
    const context = createContext(RoleRoutes.prototype.adminRoute);

    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({
        code: ErrorCode.SESSION_REQUIRED,
        status: 401,
      }) as Error,
    );
  });

  it('should allow a user whose role is listed', () => {
    const context = createContext(
      RoleRoutes.prototype.adminRoute,
      UserRole.ADMIN,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow any of several listed roles', () => {
    const context = createContext(
      RoleRoutes.prototype.staffRoute,
      UserRole.MANAGER,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject a role that is not listed with FORBIDDEN', () => {
    const context = createContext(
      RoleRoutes.prototype.adminRoute,
      UserRole.USER,
    );

    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({
        code: ErrorCode.FORBIDDEN,
        status: 403,
      }) as Error,
    );
  });
});
