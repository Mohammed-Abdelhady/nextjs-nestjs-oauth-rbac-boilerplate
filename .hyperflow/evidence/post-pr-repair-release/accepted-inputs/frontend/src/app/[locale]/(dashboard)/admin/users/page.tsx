'use client';

import { useState, useMemo, useCallback, useEffect, lazy, Suspense, Activity } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingRegion } from '@/components/layout/LoadingRegion';
import { PaginationControl } from '@/components/pagination';
import { useGetUsersQuery } from '@/modules/users/api/usersApi';
import { UserListSkeleton, UserListToolbar, UserGroupedList } from '@/modules/users/components';
import { CreateUserButton } from '@/modules/permissions/components/CreateUserButton';
import { USER_PERMISSIONS, PermissionGuard, RoutePermissionGuard } from '@/modules/permissions';
import { useDebounce } from '@/hooks/useDebounce';
import { useAppDispatch } from '@/store/hooks';
import { baseApi } from '@/store/api/baseApi';
import { parseApiError } from '@/lib/apiError';

const UserPermissionsDialog = lazy(() =>
  import('@/modules/permissions/components/UserPermissionsDialog').then((mod) => ({
    default: mod.UserPermissionsDialog,
  })),
);

export default function AdminUsersPage() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [shouldAnimate, setShouldAnimate] = useState(true);

  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    const timer = setTimeout(() => setShouldAnimate(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const {
    data: usersData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetUsersQuery({
    page,
    limit: 20,
    search: debouncedSearch.trim() || undefined,
    role: roleFilter !== 'all' ? roleFilter : undefined,
  });

  const users = useMemo(() => usersData?.users || [], [usersData?.users]);
  const totalPages = usersData?.totalPages || 1;
  const totalCount = usersData?.total ?? users.length;

  const verifiedUsers = useMemo(() => users.filter((u) => u.isVerified), [users]);
  const pendingUsers = useMemo(() => users.filter((u) => !u.isVerified), [users]);

  const handleManagePermissions = useCallback((userId: string) => {
    setSelectedUserId(userId);
  }, []);

  const handleClosePermissionsDialog = useCallback((open: boolean) => {
    if (!open) setSelectedUserId(null);
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
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

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setRoleFilter('all');
    setPage(1);
  }, []);

  const isFiltered = Boolean(debouncedSearch.trim()) || roleFilter !== 'all';

  return (
    <RoutePermissionGuard permission={USER_PERMISSIONS.LIST_ALL}>
      <div className="container max-w-7xl py-8 px-4" data-testid="admin-users-page">
        {/* Header */}
        <div className="my-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {t('count', { count: totalCount })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || isFetching}
                aria-busy={isLoading || isFetching}
                data-testid="refresh-users-button"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={`h-4 w-4 me-2 ${isLoading || isFetching ? 'motion-safe:animate-spin' : ''}`}
                />
                {t('refresh')}
              </Button>
              <PermissionGuard permission={USER_PERMISSIONS.CREATE_ALL}>
                <CreateUserButton />
              </PermissionGuard>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <UserListToolbar
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setPage(1);
          }}
          onSearchClear={() => {
            setSearchQuery('');
            setPage(1);
          }}
          roleFilter={roleFilter}
          onRoleFilterChange={(role) => {
            setRoleFilter(role);
            setPage(1);
          }}
        />

        {/* State 1: Skeleton Loading */}
        <Activity mode={isLoading ? 'visible' : 'hidden'}>
          <UserListSkeleton />
        </Activity>

        {/* State 2: Error */}
        <Activity mode={!isLoading && isError ? 'visible' : 'hidden'}>
          <Alert variant="destructive" data-testid="error-state">
            <AlertDescription className="flex items-center justify-between">
              <span>
                {t('loadError')} {error ? parseApiError(error).message : t('tryAgain')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                data-testid="retry-users-button"
              >
                {tCommon('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        </Activity>

        {/* State 3: Empty */}
        <Activity mode={!isLoading && !isError && users.length === 0 ? 'visible' : 'hidden'}>
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            data-testid="empty-state"
          >
            <Users className="h-10 w-10 text-muted-foreground mb-3" aria-hidden="true" />
            <h2 className="text-lg font-semibold">{isFiltered ? t('noUsers') : t('noUsersYet')}</h2>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              {isFiltered ? t('noUsersHint') : t('noUsersYetHint')}
            </p>
            {isFiltered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                data-testid="clear-filters-button"
              >
                {tCommon('clearSearch')}
              </Button>
            ) : (
              <PermissionGuard permission={USER_PERMISSIONS.CREATE_ALL}>
                <CreateUserButton />
              </PermissionGuard>
            )}
          </div>
        </Activity>

        {/* State 4: Data */}
        <Activity mode={!isLoading && !isError && users.length > 0 ? 'visible' : 'hidden'}>
          <UserGroupedList
            verifiedUsers={verifiedUsers}
            pendingUsers={pendingUsers}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
            shouldAnimate={shouldAnimate}
            onManagePermissions={handleManagePermissions}
          />

          <PaginationControl
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            isLoading={isLoading || isFetching}
          />

          <div className="mt-2 text-xs text-tertiary">
            {t('showingCount', { filtered: users.length, total: totalCount })}
          </div>
        </Activity>

        {/* User Permissions Dialog */}
        <Activity mode={selectedUserId ? 'visible' : 'hidden'}>
          <Suspense
            fallback={<LoadingRegion label={tCommon('loading')} rows={2} testId="dialog-loading" />}
          >
            <UserPermissionsDialog
              userId={selectedUserId || ''}
              open={!!selectedUserId}
              onOpenChange={handleClosePermissionsDialog}
            />
          </Suspense>
        </Activity>
      </div>
    </RoutePermissionGuard>
  );
}
