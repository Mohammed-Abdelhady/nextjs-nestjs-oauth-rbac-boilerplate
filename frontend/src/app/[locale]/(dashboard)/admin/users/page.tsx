'use client';

import { useState, useMemo, useCallback, useEffect, lazy, Suspense, Activity } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SearchBar } from '@/components/design-system';
import { useGetUsersQuery } from '@/store/api/userApi';
import { UserCard } from '@/modules/permissions/components/UserCard';
import { UserListSection } from '@/modules/permissions/components/UserListSection';
import { CreateUserButton } from '@/modules/permissions/components/CreateUserButton';
import { USER_PERMISSIONS, PermissionGuard, RoutePermissionGuard } from '@/modules/permissions';
import { useUserFilters } from '@/modules/permissions/hooks/useUserFilters';
import { useAppDispatch } from '@/store/hooks';
import { baseApi } from '@/store/api/baseApi';
import { parseApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';

/** Section identifiers for user groups */
enum UserSection {
  VERIFIED = 'verified',
  PENDING = 'pending',
}

/** Role filter options */
enum RoleFilter {
  ALL = 'all',
}

// Lazy load permissions dialog
const UserPermissionsDialog = lazy(() =>
  import('@/modules/permissions/components/UserPermissionsDialog').then((mod) => ({
    default: mod.UserPermissionsDialog,
  })),
);

/**
 * Admin users management page - Grouped layout with co-located dialogs
 * Accessible at /admin/users
 */
export default function AdminUsersPage() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(RoleFilter.ALL);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<UserSection>>(new Set());
  const [shouldAnimate, setShouldAnimate] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldAnimate(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const { data: usersData, isLoading, isError, error, refetch } = useGetUsersQuery({});
  const users = useMemo(() => usersData?.users || [], [usersData?.users]);

  // Use extracted filter hook
  const { filteredUsers, verifiedUsers, pendingUsers, uniqueRoles } = useUserFilters(users, {
    searchQuery,
    roleFilter,
  });

  // Detect and handle invalid cached user IDs
  useEffect(() => {
    if (users.length > 0) {
      const hasInvalidIds = users.some((user) => user._id && !/^[a-f\d]{24}$/i.test(user._id));
      if (hasInvalidIds) {
        dispatch(baseApi.util.invalidateTags(['User']));
        refetch();
      }
    }
  }, [users, dispatch, refetch]);

  const handleManagePermissions = useCallback((userId: string) => {
    setSelectedUserId(userId);
  }, []);

  const handleClosePermissionsDialog = useCallback((open: boolean) => {
    if (!open) setSelectedUserId(null);
  }, []);

  const toggleSection = useCallback((sectionId: UserSection) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    dispatch(baseApi.util.invalidateTags(['User']));
    refetch();
  }, [dispatch, refetch]);

  return (
    <RoutePermissionGuard permission={USER_PERMISSIONS.LIST_ALL}>
      <div className="container max-w-7xl py-8 px-4" data-testid="admin-users-page">
        {/* Header */}
        <div className="my-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {t('count', { count: users.length })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                data-testid="refresh-users-button"
              >
                <RefreshCw className={`h-4 w-4 me-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('refresh')}
              </Button>
              <PermissionGuard permission={USER_PERMISSIONS.CREATE_ALL}>
                <CreateUserButton />
              </PermissionGuard>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchBar
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              showClear={searchQuery.length > 0}
              data-testid="search-users-input"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-50" data-testid="role-filter">
              <SelectValue placeholder={t('allRoles')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={RoleFilter.ALL}>{t('allRoles')}</SelectItem>
              {uniqueRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        <Activity mode={isLoading ? 'visible' : 'hidden'}>
          <div className="flex items-center justify-center py-12" data-testid="loading-skeleton">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            </div>
          </div>
        </Activity>

        {/* Error State */}
        <Activity mode={isError ? 'visible' : 'hidden'}>
          <Alert variant="destructive" data-testid="error-state">
            <AlertDescription className="flex items-center justify-between">
              <span>
                {t('loadError')} {error ? parseApiError(error).message : t('tryAgain')}
              </span>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {tCommon('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        </Activity>

        {/* Empty State */}
        <Activity
          mode={!isLoading && !isError && filteredUsers.length === 0 ? 'visible' : 'hidden'}
        >
          <div
            className="flex items-center justify-center py-12 text-center"
            data-testid="empty-state"
          >
            <div className="space-y-3">
              <p className="text-lg font-semibold">
                {searchQuery || roleFilter !== RoleFilter.ALL ? t('noUsers') : t('noUsersYet')}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchQuery || roleFilter !== RoleFilter.ALL
                  ? t('noUsersHint')
                  : t('noUsersYetHint')}
              </p>
            </div>
          </div>
        </Activity>

        {/* Grouped Users - stays mounted for smoother transitions */}
        <Activity mode={!isLoading && !isError && filteredUsers.length > 0 ? 'visible' : 'hidden'}>
          <div className="space-y-8">
            <UserListSection
              id={UserSection.VERIFIED}
              title={t('verifiedUsers')}
              count={verifiedUsers.length}
              collapsed={collapsedSections.has(UserSection.VERIFIED)}
              onCollapse={() => toggleSection(UserSection.VERIFIED)}
            >
              {verifiedUsers.map((user, index) => (
                <div
                  key={user._id}
                  className={cn(
                    shouldAnimate && 'motion-safe:animate-slide-up motion-safe:stagger-animation',
                  )}
                  style={{ '--index': index } as React.CSSProperties}
                >
                  <UserCard user={user} onManagePermissions={handleManagePermissions} />
                </div>
              ))}
            </UserListSection>

            {pendingUsers.length > 0 && (
              <UserListSection
                id={UserSection.PENDING}
                title={t('pendingVerification')}
                count={pendingUsers.length}
                collapsed={collapsedSections.has(UserSection.PENDING)}
                onCollapse={() => toggleSection(UserSection.PENDING)}
              >
                {pendingUsers.map((user, index) => (
                  <div
                    key={user._id}
                    className={cn(
                      shouldAnimate && 'motion-safe:animate-slide-up motion-safe:stagger-animation',
                    )}
                    style={{ '--index': index } as React.CSSProperties}
                  >
                    <UserCard user={user} onManagePermissions={handleManagePermissions} />
                  </div>
                ))}
              </UserListSection>
            )}
          </div>

          {/* Results Summary */}
          <div className="mt-6 text-xs text-tertiary">
            {t('showingCount', { filtered: filteredUsers.length, total: users.length })}
          </div>
        </Activity>

        {/* User Permissions Dialog - stays mounted for instant re-open */}
        <Suspense fallback={<div />}>
          <Activity mode={selectedUserId ? 'visible' : 'hidden'}>
            <UserPermissionsDialog
              userId={selectedUserId || ''}
              open={!!selectedUserId}
              onOpenChange={handleClosePermissionsDialog}
            />
          </Activity>
        </Suspense>
      </div>
    </RoutePermissionGuard>
  );
}
