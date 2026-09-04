import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  ANY_PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { hasAllPermissions, hasAnyPermission } from '../utils/permission.utils';

/**
 * Guard that enforces permission-based authorization.
 * Works with @RequirePermissions and @RequireAnyPermission decorators.
 *
 * Authentication comes from the global AuthGuard, so only this guard has to be
 * listed on the route.
 *
 * Usage:
 * 1. Apply @UseGuards(PermissionGuard) to controller or method
 * 2. Use @RequirePermissions('permission:action:scope') decorator
 *
 * @example
 * ```typescript
 * @UseGuards(PermissionGuard)
 * @RequirePermissions('users:read:all')
 * @Get()
 * async listUsers() {
 *   return this.userService.findAll();
 * }
 * ```
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required permissions from decorator (ALL permissions required)
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Get required permissions with OR logic (ANY permission required)
    const anyPermissions = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions specified, allow access
    if (!requiredPermissions && !anyPermissions) {
      return true;
    }

    // Get user from request (populated by AuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userPermissions: string[] = user.permissions || [];

    // Check ALL permissions (AND logic)
    if (requiredPermissions && requiredPermissions.length > 0) {
      if (!hasAllPermissions(userPermissions, requiredPermissions)) {
        throw new ForbiddenException(
          `Missing required permissions: ${requiredPermissions.join(', ')}`,
        );
      }
    }

    // Check ANY permissions (OR logic)
    if (anyPermissions && anyPermissions.length > 0) {
      if (!hasAnyPermission(userPermissions, anyPermissions)) {
        throw new ForbiddenException(
          `Missing at least one required permission: ${anyPermissions.join(', ')}`,
        );
      }
    }

    return true;
  }
}
