'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldAlert } from 'lucide-react';
import { parsePermission } from '../utils/permissionUtils';

export interface PermissionsListProps {
  /**
   * Array of permissions to display
   */
  permissions: string[];

  /**
   * Whether to show as a compact list
   * Default: false
   */
  compact?: boolean;

  /**
   * Maximum number of permissions to show
   * Default: unlimited
   */
  limit?: number;

  /**
   * Callback when "show more" is clicked (for limited lists)
   */
  onShowMore?: () => void;
}

/**
 * Component to display a list of permissions with formatting.
 *
 * @example
 * ```tsx
 * <PermissionsList
 *   permissions={['users:read:all', 'users:update:all', 'roles:read:all']}
 *   limit={5}
 * />
 * ```
 */
export function PermissionsList({
  permissions,
  compact = false,
  limit,
  onShowMore,
}: PermissionsListProps) {
  const t = useTranslations('permissions.list');
  const hasWildcard = permissions.includes('*');

  if (permissions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('empty')}</p>
      </div>
    );
  }

  if (hasWildcard) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100">{t('wildcardTitle')}</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">{t('wildcardDescription')}</p>
          </div>
        </div>
      </div>
    );
  }

  const displayPermissions = limit ? permissions.slice(0, limit) : permissions;
  const remaining = limit ? permissions.length - limit : 0;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {displayPermissions.map((permission) => {
          const parsed = parsePermission(permission);
          return (
            <Badge key={permission} variant="secondary" className="text-xs">
              {parsed ? `${parsed.resource}:${parsed.action}` : permission}
            </Badge>
          );
        })}
        {remaining > 0 && (
          <Badge
            variant="outline"
            className="cursor-pointer text-xs"
            onClick={onShowMore}
            data-testid="permissions-list-more-badge"
          >
            {t('moreBadge', { count: remaining })}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayPermissions.map((permission) => {
        const parsed = parsePermission(permission);
        return (
          <div
            key={permission}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <div>
                <code className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {permission}
                </code>
                {parsed && (
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {parsed.resource} • {parsed.action}
                    {parsed.scope && ` • ${parsed.scope}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {remaining > 0 && (
        <button
          type="button"
          onClick={onShowMore}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          data-testid="permissions-list-show-more"
        >
          {t('showMore', { count: remaining })}
        </button>
      )}
    </div>
  );
}
