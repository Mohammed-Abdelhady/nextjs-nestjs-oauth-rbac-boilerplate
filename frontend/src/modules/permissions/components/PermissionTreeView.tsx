'use client';

import { memo, useMemo } from 'react';
import { PermissionNode } from './PermissionNode';
import { Shield } from 'lucide-react';

export interface PermissionTreeViewProps {
  /**
   * Array of permission strings
   */
  permissions: string[];

  /**
   * Variant for all nodes
   */
  variant?: 'default' | 'inherited' | 'direct';

  /**
   * Show group headers
   */
  showHeaders?: boolean;

  /**
   * Optional className
   */
  className?: string;
}

/**
 * PermissionTreeView - Hierarchical permission display
 *
 * Features:
 * - Groups permissions by resource (users, roles, sessions, etc.)
 * - Tree-style visualization
 * - Wildcard detection and highlighting
 * - Minimal aesthetic
 *
 * @example
 * ```tsx
 * <PermissionTreeView
 *   permissions={['users:read:all', 'users:update:all', 'roles:*']}
 *   variant="inherited"
 *   showHeaders
 * />
 * ```
 */
export const PermissionTreeView = memo(function PermissionTreeView({
  permissions,
  variant = 'default',
  showHeaders = true,
  className,
}: PermissionTreeViewProps) {
  // Group permissions by resource
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, string[]> = {};

    permissions.forEach((perm) => {
      if (perm === '*') {
        groups['wildcard'] = ['*'];
        return;
      }

      const resource = perm.split(':')[0];
      if (!groups[resource]) {
        groups[resource] = [];
      }
      groups[resource].push(perm);
    });

    return groups;
  }, [permissions]);

  // Check for wildcard
  const hasWildcard = permissions.includes('*');

  if (permissions.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">No permissions assigned</div>
    );
  }

  return (
    <div className={className} data-testid="permission-tree-view">
      {/* Wildcard Warning */}
      {hasWildcard && (
        <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30">
          <p className="text-sm text-warning-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <strong>Wildcard (*)</strong> - This role has all permissions
          </p>
        </div>
      )}

      {/* Grouped Permissions */}
      <div className="space-y-4">
        {Object.entries(groupedPermissions).map(([resource, perms]) => (
          <div key={resource} className="space-y-2">
            {/* Resource Header */}
            {showHeaders && resource !== 'wildcard' && (
              <h4 className="text-xs uppercase tracking-widest text-tertiary">{resource}</h4>
            )}

            {/* Permission Nodes */}
            <div className="space-y-1">
              {perms.map((perm) => (
                <PermissionNode
                  key={perm}
                  permission={perm}
                  level={resource === 'wildcard' ? 0 : 0}
                  variant={variant}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
