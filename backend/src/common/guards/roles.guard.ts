import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../user/enums/user-role.enum';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../enums/error-code.enum';

/**
 * Guard to restrict route access based on user roles.
 * Reads the user that the global AuthGuard put on the request.
 *
 * @example
 * ```typescript
 * @UseGuards(RolesGuard)
 * @Roles(UserRole.ADMIN)
 * @Get('admin-only')
 * adminOnlyEndpoint() { ... }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request (set by AuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Ensure user exists (should be set by AuthGuard)
    if (!user) {
      throw new AppException(
        ErrorCode.SESSION_REQUIRED,
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Check if user's role is in the allowed roles
    const hasPermission = requiredRoles.includes(user.role as UserRole);

    if (!hasPermission) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
