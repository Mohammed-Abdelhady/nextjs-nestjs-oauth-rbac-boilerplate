'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PROFILE_PERMISSIONS,
  USER_PERMISSIONS,
  ROLE_PERMISSIONS,
  PERMISSION_PERMISSIONS,
  SESSION_PERMISSIONS,
  REPORT_PERMISSIONS,
  WILDCARD_PERMISSION,
} from '../constants/permissions';

import { PermissionGroupGrid } from './PermissionGroupGrid';

export interface PermissionSelectorProps {
  /**
   * Currently selected permissions
   */
  selectedPermissions: string[];

  /**
   * Callback when permissions change
   */
  onChange: (permissions: string[]) => void;

  /**
   * Whether the selector is disabled
   */
  disabled?: boolean;

  /**
   * Whether to show the wildcard permission option
   * Default: true
   */
  showWildcard?: boolean;
}

interface PermissionGroup {
  name: string;
  permissions: Record<string, string>;
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  { name: 'Profile', permissions: PROFILE_PERMISSIONS },
  { name: 'Users', permissions: USER_PERMISSIONS },
  { name: 'Roles', permissions: ROLE_PERMISSIONS },
  { name: 'Permissions', permissions: PERMISSION_PERMISSIONS },
  { name: 'Sessions', permissions: SESSION_PERMISSIONS },
  { name: 'Reports', permissions: REPORT_PERMISSIONS },
];

/**
 * Component for selecting permissions.
 * Organizes permissions by resource category with checkboxes.
 */
export const PermissionSelector = memo(function PermissionSelector({
  selectedPermissions,
  onChange,
  disabled = false,
  showWildcard = true,
}: PermissionSelectorProps) {
  const [activeTab, setActiveTab] = useState('all');
  const handleTogglePermission = useCallback(
    (permission: string) => {
      if (disabled) return;

      const isSelected = selectedPermissions.includes(permission);

      if (isSelected) {
        onChange(selectedPermissions.filter((p) => p !== permission));
      } else {
        onChange([...selectedPermissions, permission]);
      }
    },
    [disabled, selectedPermissions, onChange],
  );

  const handleToggleWildcard = useCallback(() => {
    if (disabled) return;

    const hasWildcard = selectedPermissions.includes(WILDCARD_PERMISSION);

    if (hasWildcard) {
      onChange(selectedPermissions.filter((p) => p !== WILDCARD_PERMISSION));
    } else {
      onChange([WILDCARD_PERMISSION]);
    }
  }, [disabled, selectedPermissions, onChange]);

  const handleSelectAll = useCallback(
    (groupPermissions: Record<string, string>) => {
      if (disabled) return;

      const groupPerms = Object.values(groupPermissions);
      const allSelected = groupPerms.every((p) => selectedPermissions.includes(p));

      if (allSelected) {
        onChange(selectedPermissions.filter((p) => !groupPerms.includes(p)));
      } else {
        const newPermissions = [...selectedPermissions];
        groupPerms.forEach((p) => {
          if (!newPermissions.includes(p)) {
            newPermissions.push(p);
          }
        });
        onChange(newPermissions);
      }
    },
    [disabled, selectedPermissions, onChange],
  );

  const hasWildcard = selectedPermissions.includes(WILDCARD_PERMISSION);

  const groupStats = useMemo(() => {
    const stats: Record<string, number> = {};
    PERMISSION_GROUPS.forEach((group) => {
      const groupPerms = Object.values(group.permissions);
      stats[group.name] = groupPerms.filter((p) => selectedPermissions.includes(p)).length;
    });
    return stats;
  }, [selectedPermissions]);

  return (
    <div className="space-y-4">
      {/* Wildcard Permission */}
      {showWildcard && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="wildcard-permission"
              checked={hasWildcard}
              onCheckedChange={handleToggleWildcard}
              disabled={disabled}
              data-testid="wildcard-permission-checkbox"
            />
            <div className="flex-1">
              <Label
                htmlFor="wildcard-permission"
                className="font-semibold text-warning-foreground"
              >
                Wildcard Permission (*)
              </Label>
              <p className="mt-1 text-sm text-warning-foreground">
                Grants all permissions. Use only for super administrators.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabbed Permission Groups */}
      {!hasWildcard && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="all" className="text-xs">
              All
              {selectedPermissions.length > 0 && (
                <span className="ms-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px]">
                  {selectedPermissions.length}
                </span>
              )}
            </TabsTrigger>
            {PERMISSION_GROUPS.map((group) => (
              <TabsTrigger key={group.name} value={group.name.toLowerCase()} className="text-xs">
                {group.name}
                {groupStats[group.name] > 0 && (
                  <span className="ms-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px]">
                    {groupStats[group.name]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* All Permissions Tab */}
          <TabsContent value="all" className="mt-4 space-y-6">
            {PERMISSION_GROUPS.map((group) => {
              const groupPerms = Object.values(group.permissions);
              const allSelected = groupPerms.every((p) => selectedPermissions.includes(p));

              return (
                <div key={group.name} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-tight">{group.name}</h3>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(group.permissions)}
                      disabled={disabled}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <PermissionGroupGrid
                    permissions={group.permissions}
                    selectedPermissions={selectedPermissions}
                    onTogglePermission={handleTogglePermission}
                    disabled={disabled}
                  />
                </div>
              );
            })}
          </TabsContent>

          {/* Individual Category Tabs */}
          {PERMISSION_GROUPS.map((group) => {
            const groupPerms = Object.values(group.permissions);
            const allSelected = groupPerms.every((p) => selectedPermissions.includes(p));

            return (
              <TabsContent
                key={group.name}
                value={group.name.toLowerCase()}
                className="mt-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {groupPerms.length} permission{groupPerms.length !== 1 ? 's' : ''} available
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(group.permissions)}
                    disabled={disabled}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <PermissionGroupGrid
                  permissions={group.permissions}
                  selectedPermissions={selectedPermissions}
                  onTogglePermission={handleTogglePermission}
                  disabled={disabled}
                  prefix={group.name}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Wildcard Notice */}
      {hasWildcard && (
        <div className="rounded-lg border border-border bg-muted p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Wildcard permission selected. All other permissions are implicitly granted.
          </p>
        </div>
      )}

      {/* Permission Count */}
      <div className="text-sm text-muted-foreground">
        {hasWildcard ? (
          <span>All permissions granted via wildcard (*)</span>
        ) : (
          <span>
            {selectedPermissions.length} permission{selectedPermissions.length !== 1 ? 's' : ''}{' '}
            selected
          </span>
        )}
      </div>
    </div>
  );
});
