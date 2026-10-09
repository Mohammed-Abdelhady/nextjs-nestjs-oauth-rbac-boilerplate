import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '@app/core';

/**
 * Hook to check user permissions.
 * Provides utility functions to check if the current user has specific permissions.
 *
 * @returns Object with permission checking functions
 *
 * @example
 * ```tsx
 * const { can, canAny, canAll } = usePermission();
 *
 * if (can('users:read:all')) {
 *   // User can read all users
 * }
 *
 * if (canAny(['users:read:all', 'users:update:all'])) {
 *   // User can read OR update users
 * }
 *
 * if (canAll(['users:read:all', 'users:update:all'])) {
 *   // User can read AND update users
 * }
 * ```
 */
export function usePermission() {
  const user = useSelector((state: RootState) => state.auth.user);
  const userPermissions = user?.permissions || [];

  /**
   * Check if user has a specific permission.
   * Wildcard permission (*) grants all access.
   *
   * @param permission - Permission to check
   * @returns true if user has the permission
   */
  const can = (permission: string): boolean => {
    return hasPermission(userPermissions, permission);
  };

  /**
   * Check if user has any of the specified permissions (OR logic).
   *
   * @param permissions - Array of permissions to check
   * @returns true if user has at least one permission
   */
  const canAny = (permissions: string[]): boolean => {
    return hasAnyPermission(userPermissions, permissions);
  };

  /**
   * Check if user has all of the specified permissions (AND logic).
   *
   * @param permissions - Array of permissions to check
   * @returns true if user has all permissions
   */
  const canAll = (permissions: string[]): boolean => {
    return hasAllPermissions(userPermissions, permissions);
  };

  return {
    can,
    canAny,
    canAll,
    permissions: userPermissions,
  };
}
