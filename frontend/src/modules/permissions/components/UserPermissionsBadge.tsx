'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';

export interface UserPermissionsBadgeProps {
  /**
   * Array of user permissions
   */
  permissions: string[];

  /**
   * Maximum number of permissions to show before truncating
   * Default: 3
   */
  maxDisplay?: number;

  /**
   * Whether to show the count badge
   * Default: true
   */
  showCount?: boolean;
}

/**
 * Component to display user permissions as badges.
 * Shows a limited number of permissions with a count for the rest.
 *
 * @example
 * ```tsx
 * <UserPermissionsBadge
 *   permissions={['users:read:all', 'users:update:all', 'roles:read:all']}
 *   maxDisplay={2}
 * />
 * ```
 */
export function UserPermissionsBadge({
  permissions,
  maxDisplay = 3,
  showCount = true,
}: UserPermissionsBadgeProps) {
  const t = useTranslations('permissions');

  if (permissions.length === 0) {
    return <span className="text-sm text-gray-500 dark:text-gray-400">{t('badge.empty')}</span>;
  }

  const hasWildcard = permissions.includes('*');

  if (hasWildcard) {
    return (
      <Badge variant="default" className="bg-amber-600 hover:bg-amber-700">
        <Shield className="me-1 h-3 w-3" aria-hidden="true" />
        {t('tree.wildcardLabel')}
      </Badge>
    );
  }

  const displayPermissions = permissions.slice(0, maxDisplay);
  const remainingCount = permissions.length - maxDisplay;

  return (
    <div className="flex flex-wrap gap-1">
      {displayPermissions.map((permission) => (
        <Badge key={permission} variant="secondary" className="text-xs">
          {permission.split(':')[0]}
        </Badge>
      ))}
      {showCount && remainingCount > 0 && (
        <Badge variant="outline" className="text-xs">
          {t('list.moreBadge', { count: remainingCount })}
        </Badge>
      )}
    </div>
  );
}
