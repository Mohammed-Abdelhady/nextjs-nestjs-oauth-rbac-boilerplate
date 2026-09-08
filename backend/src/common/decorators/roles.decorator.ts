import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../user/enums/user-role.enum';

/**
 * Metadata key for storing required roles on route handlers.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles are required to access a route.
 * Can be applied at the controller or method level.
 *
 * @example
 * ```typescript
 * @Roles(UserRole.ADMIN)
 * @UseGuards(RolesGuard)
 * @Get('admin-only')
 * adminOnlyEndpoint() { ... }
 * ```
 *
 * @example
 * ```typescript
 * @Roles(UserRole.ADMIN, UserRole.MANAGER)
 * @UseGuards(RolesGuard)
 * @Get('admin-or-manager')
 * adminOrManagerEndpoint() { ... }
 * ```
 *
 * @param roles - Array of UserRole enums that are allowed to access the route
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
