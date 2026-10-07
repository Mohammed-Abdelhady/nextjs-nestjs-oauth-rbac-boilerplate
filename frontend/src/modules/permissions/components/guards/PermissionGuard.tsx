'use client';

import { ReactNode } from 'react';
import { usePermission } from '../../hooks/usePermission';

export interface PermissionGuardProps {
  /**
   * Children to render if permission check passes
   */
  children: ReactNode;

  /**
   * Single permission required (AND logic with permissions array)
   */
  permission?: string;

  /**
   * Array of permissions - user must have ALL (AND logic)
   */
  permissions?: string[];

  /**
   * Array of permissions - user needs ANY (OR logic)
   */
  anyPermissions?: string[];

  /**
   * Fallback content to render if permission check fails
   * If not provided, nothing is rendered (element is hidden)
   */
  fallback?: ReactNode;

  /**
   * If true, renders fallback/nothing instead of children when permission is missing
   * If false, throws error (useful for debugging)
   * Default: true
   */
  hideOnFail?: boolean;
}

/**
 * Component that conditionally renders children based on user permissions.
 * By default, hides content if permission check fails.
 *
 * @example
 * ```tsx
 * // Single permission check
 * <PermissionGuard permission="users:read:all">
 *   <UserList />
 * </PermissionGuard>
 *
 * // Multiple permissions (AND logic - user needs ALL)
 * <PermissionGuard permissions={['users:read:all', 'users:update:all']}>
 *   <UserManagement />
 * </PermissionGuard>
 *
 * // Any permission (OR logic - user needs ANY)
 * <PermissionGuard anyPermissions={['users:read:all', 'users:update:all']}>
 *   <UserActions />
 * </PermissionGuard>
 *
 * // With fallback content
 * <PermissionGuard
 *   permission="users:delete:all"
 *   fallback={<p>You don't have permission to delete users</p>}
 * >
 *   <DeleteButton />
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  children,
  permission,
  permissions,
  anyPermissions,
  fallback = null,
  hideOnFail = true,
}: PermissionGuardProps) {
  const { can, canAll, canAny } = usePermission();

  // Determine if user has required permissions
  let hasAccess = true;

  // Check single permission
  if (permission && !can(permission)) {
    hasAccess = false;
  }

  // Check all permissions (AND logic)
  if (permissions && permissions.length > 0 && !canAll(permissions)) {
    hasAccess = false;
  }

  // Check any permissions (OR logic)
  if (anyPermissions && anyPermissions.length > 0 && !canAny(anyPermissions)) {
    hasAccess = false;
  }

  // If user doesn't have access
  if (!hasAccess) {
    if (hideOnFail) {
      return <>{fallback}</>;
    }

    // In development, throw error for debugging
    if (process.env.NODE_ENV === 'development') {
      const requiredPerms = [permission, ...(permissions || []), ...(anyPermissions || [])].filter(
        Boolean,
      );

      console.error(
        `PermissionGuard: Access denied. Required permissions: ${requiredPerms.join(', ')}`,
      );
    }

    return <>{fallback}</>;
  }

  return <>{children}</>;
}
