'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchPermissionGrid } from './SearchPermissionGrid';
import {
  PROFILE_PERMISSIONS,
  USER_PERMISSIONS,
  ROLE_PERMISSIONS,
  PERMISSION_PERMISSIONS,
  SESSION_PERMISSIONS,
  REPORT_PERMISSIONS,
} from '../constants/permissions';

export interface PermissionGroup {
  id: string;
  name: string;
  permissions: Record<string, string>;
}

export interface FilteredPermissionGroup extends PermissionGroup {
  filteredPermissions: Record<string, string>;
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  { id: 'profile', name: 'Profile', permissions: PROFILE_PERMISSIONS },
  { id: 'users', name: 'Users', permissions: USER_PERMISSIONS },
  { id: 'roles', name: 'Roles', permissions: ROLE_PERMISSIONS },
  { id: 'permissions', name: 'Permissions', permissions: PERMISSION_PERMISSIONS },
  { id: 'sessions', name: 'Sessions', permissions: SESSION_PERMISSIONS },
  { id: 'reports', name: 'Reports', permissions: REPORT_PERMISSIONS },
];

export interface SearchPermissionTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  filteredGroups: FilteredPermissionGroup[];
  selectedPermissions: string[];
  onSelectAll: (permissions: Record<string, string>) => void;
  onTogglePermission: (permission: string) => void;
  isLoading?: boolean;
  searchQuery: string;
}

export function SearchPermissionTabs({
  activeTab,
  onTabChange,
  filteredGroups,
  selectedPermissions,
  onSelectAll,
  onTogglePermission,
  isLoading = false,
  searchQuery,
}: SearchPermissionTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={onTabChange}
      className="flex-1 flex flex-col overflow-hidden"
    >
      <TabsList className="grid w-full grid-cols-7">
        <TabsTrigger value="all">All</TabsTrigger>
        {PERMISSION_GROUPS.map((group) => (
          <TabsTrigger key={group.id} value={group.id}>
            {group.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* All Permissions Tab */}
      <TabsContent value="all" className="flex-1 overflow-y-auto mt-4 space-y-6">
        {filteredGroups.map((group) => {
          const groupPerms = Object.values(group.filteredPermissions);
          const allSelected = groupPerms.every((p) => selectedPermissions.includes(p));

          return (
            <div key={group.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-tight">{group.name}</h3>
                <button
                  type="button"
                  onClick={() => onSelectAll(group.filteredPermissions)}
                  disabled={isLoading || groupPerms.length === 0}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <SearchPermissionGrid
                permissions={group.filteredPermissions}
                selectedPermissions={selectedPermissions}
                onTogglePermission={onTogglePermission}
                isLoading={isLoading}
              />
            </div>
          );
        })}

        {filteredGroups.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No permissions found matching &quot;{searchQuery}&quot;
          </div>
        )}
      </TabsContent>

      {/* Individual Category Tabs */}
      {PERMISSION_GROUPS.map((group) => {
        const filtered = filteredGroups.find((g) => g.id === group.id);
        const groupPerms = filtered ? Object.values(filtered.filteredPermissions) : [];
        const allSelected = groupPerms.every((p) => selectedPermissions.includes(p));

        return (
          <TabsContent
            key={group.id}
            value={group.id}
            className="flex-1 overflow-y-auto mt-4 space-y-4"
          >
            {filtered && groupPerms.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {groupPerms.length} permission{groupPerms.length !== 1 ? 's' : ''} available
                  </p>
                  <button
                    type="button"
                    onClick={() => onSelectAll(filtered.filteredPermissions)}
                    disabled={isLoading}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <SearchPermissionGrid
                  permissions={filtered.filteredPermissions}
                  selectedPermissions={selectedPermissions}
                  onTogglePermission={onTogglePermission}
                  isLoading={isLoading}
                />
              </>
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {searchQuery
                  ? `No ${group.name.toLowerCase()} permissions found matching "${searchQuery}"`
                  : `All ${group.name.toLowerCase()} permissions are already assigned`}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
