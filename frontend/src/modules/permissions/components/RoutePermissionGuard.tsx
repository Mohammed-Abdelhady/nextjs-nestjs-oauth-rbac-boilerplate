'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { LoadingRegion } from '@/components/layout/LoadingRegion';
import { useAppSelector } from '@/store/hooks';
import { selectUser, selectIsAuthenticated } from '@/modules/auth/store/authSlice';
import { usePermission } from '../hooks/usePermission';

export interface RoutePermissionGuardProps {
  /**
   * Children to render if permission check passes
   */
  readonly children: React.ReactNode;

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
   * Fallback path to redirect to if permission check fails
   * Default: '/403' (forbidden page)
   */
  fallbackPath?: string;
}

/**
 * Route-level permission guard that redirects unauthorized users.
 * Should be used inside AuthGuard for protected routes.
 *
 * @example
 * ```tsx
 * // Protect route with single permission
 * export default function UsersPage() {
 *   return (
 *     <AuthGuard>
 *       <RoutePermissionGuard permission="users:read:all">
 *         <UsersList />
 *       </RoutePermissionGuard>
 *     </AuthGuard>
 *   );
 * }
 *
 * // Protect route requiring multiple permissions (AND logic)
 * export default function UserManagementPage() {
 *   return (
 *     <AuthGuard>
 *       <RoutePermissionGuard permissions={['users:read:all', 'users:update:all']}>
 *         <UserManagement />
 *       </RoutePermissionGuard>
 *     </AuthGuard>
 *   );
 * }
 *
 * // Protect route requiring any permission (OR logic)
 * export default function UserActionsPage() {
 *   return (
 *     <AuthGuard>
 *       <RoutePermissionGuard anyPermissions={['users:read:all', 'users:update:all']}>
 *         <UserActions />
 *       </RoutePermissionGuard>
 *     </AuthGuard>
 *   );
 * }
 * ```
 */
export function RoutePermissionGuard({
  children,
  permission,
  permissions,
  anyPermissions,
  fallbackPath = '/403',
}: Readonly<RoutePermissionGuardProps>) {
  const t = useTranslations('common');
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { can, canAll, canAny } = usePermission();

  useEffect(() => {
    // Wait for authentication check
    if (!isAuthenticated || !user) {
      return;
    }

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

    // If not authorized, redirect to fallback path
    if (!hasAccess) {
      router.push(fallbackPath);
    }
  }, [
    user,
    isAuthenticated,
    permission,
    permissions,
    anyPermissions,
    fallbackPath,
    router,
    can,
    canAll,
    canAny,
  ]);

  // Wait for the session before deciding, without blanking the screen
  if (!isAuthenticated || !user) {
    return <LoadingRegion label={t('loading')} testId="permission-guard-loading" />;
  }

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

  // Redirect to the fallback is in flight; keep the status region on screen
  if (!hasAccess) {
    return <LoadingRegion label={t('loading')} testId="permission-guard-loading" />;
  }

  // User has permission, render children
  return <>{children}</>;
}
