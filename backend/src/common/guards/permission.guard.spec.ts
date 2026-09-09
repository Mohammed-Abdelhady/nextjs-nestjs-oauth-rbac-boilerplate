import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../decorators/permissions.decorator';

class PermissionRoutes {
  openRoute(this: void): void {}

  @RequirePermissions('users:read:all', 'users:update:all')
  allOfRoute(this: void): void {}

  @RequireAnyPermission('users:read:all', 'reports:read:all')
  anyOfRoute(this: void): void {}
}

interface RequestUser {
  permissions?: string[];
}

describe('PermissionGuard', () => {
  let guard: PermissionGuard;

  const createContext = (
    handler: () => void,
    user?: RequestUser,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => handler,
      getClass: () => PermissionRoutes,
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new PermissionGuard(new Reflector());
  });

  it('should allow a route that declares no permissions', () => {
    const context = createContext(PermissionRoutes.prototype.openRoute);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject an unauthenticated request on a guarded route', () => {
    const context = createContext(PermissionRoutes.prototype.allOfRoute);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  describe('@RequirePermissions', () => {
    it('should allow a user holding every listed permission', () => {
      const context = createContext(PermissionRoutes.prototype.allOfRoute, {
        permissions: ['users:read:all', 'users:update:all'],
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should reject a user missing one of the listed permissions', () => {
      const context = createContext(PermissionRoutes.prototype.allOfRoute, {
        permissions: ['users:read:all'],
      });

      expect(() => guard.canActivate(context)).toThrow(
        'Missing required permissions: users:read:all, users:update:all',
      );
    });

    it('should allow a user holding the wildcard', () => {
      const context = createContext(PermissionRoutes.prototype.allOfRoute, {
        permissions: ['*'],
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('@RequireAnyPermission', () => {
    it('should allow a user holding one of the listed permissions', () => {
      const context = createContext(PermissionRoutes.prototype.anyOfRoute, {
        permissions: ['reports:read:all'],
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should reject a user holding none of them', () => {
      const context = createContext(PermissionRoutes.prototype.anyOfRoute, {
        permissions: ['profile:read:own'],
      });

      expect(() => guard.canActivate(context)).toThrow(
        'Missing at least one required permission: users:read:all, reports:read:all',
      );
    });

    it('should treat a user without permissions as empty, not undefined', () => {
      const context = createContext(PermissionRoutes.prototype.anyOfRoute, {});

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
