'use client';

import { memo, useCallback } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/design-system';
import { UserRoleSelector } from './UserRoleSelector';
import { UserActionsMenu } from './UserActionsMenu';
import { USER_PERMISSIONS, PermissionGuard } from '@/modules/permissions';
import { cn } from '@/lib/utils';
import { getInitials, formatDateShort } from '@/lib/formatters';
import { useUserActions } from '../hooks/useUserActions';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface UserCardProps {
  /** User data */
  user: User;
  /** Callback when manage permissions is clicked */
  onManagePermissions?: (userId: string) => void;
  /** Optional className */
  className?: string;
}

/**
 * UserCard - Minimal user card with refined aesthetic.
 *
 * Features:
 * - Avatar with initials fallback
 * - Hover-reveal actions via UserActionsMenu
 * - Role selector with permission guard
 * - Status badges (verified/pending, active/inactive)
 * - Optimized with React.memo
 *
 * @example
 * ```tsx
 * <UserCard
 *   user={user}
 *   onManagePermissions={(id) => openPermissionsDialog(id)}
 * />
 * ```
 */
export const UserCard = memo(
  function UserCard({ user, onManagePermissions, className }: UserCardProps) {
    const { handleRoleChange, isUpdatingRole } = useUserActions();

    const initials = getInitials(user.name);
    const joinedDate = formatDateShort(user.createdAt);

    const handleManageClick = useCallback(() => {
      onManagePermissions?.(user._id);
    }, [onManagePermissions, user._id]);

    const onRoleChange = useCallback(
      async (newRole: string) => {
        await handleRoleChange(user._id, newRole);
      },
      [handleRoleChange, user._id],
    );

    const isAdminRole = user.role === 'admin';
    const isNormalUser = user.role === 'user';
    const isProtectedRole = isAdminRole || isNormalUser;

    return (
      <article
        data-testid={`user-card-${user._id}`}
        className={cn(
          'group relative p-4 rounded-lg',
          'bg-card border border-border',
          'transition-all duration-200 ease-out',
          'hover:border-input hover:shadow-sm',
          user.isDeleted && 'opacity-60',
          className,
        )}
      >
        {/* Header: Avatar + Name/Email + Status Badge */}
        <header className="flex items-start gap-3 mb-3">
          <Avatar className="h-10 w-10 ring-2 ring-offset-2 ring-transparent group-hover:ring-primary/20 transition-all">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium tracking-tight truncate">{user.name}</h4>
            <p className="text-xs text-tertiary tracking-wide truncate">{user.email}</p>
          </div>

          <div className="flex items-center gap-2">
            {user.isDeleted && (
              <StatusBadge
                status="inactive"
                size="sm"
                variant="soft"
                data-testid="user-inactive-badge"
              />
            )}
            <StatusBadge
              status={user.isVerified ? 'verified' : 'pending'}
              size="sm"
              variant="soft"
              data-testid="user-verification-badge"
            />
          </div>
        </header>

        {/* Role Selector + Actions Row */}
        <div className="mb-3 min-h-[32px] flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <PermissionGuard
              permission={USER_PERMISSIONS.UPDATE_ALL}
              fallback={
                <div className="text-xs text-tertiary capitalize">
                  Role: <span className="font-medium">{user.role}</span>
                </div>
              }
            >
              {isProtectedRole || user.isDeleted ? (
                <div className="text-xs text-tertiary capitalize">
                  Role: <span className="font-medium">{user.role}</span>
                </div>
              ) : (
                <UserRoleSelector
                  userId={user._id}
                  currentRole={user.role}
                  onRoleChange={onRoleChange}
                />
              )}
            </PermissionGuard>
          </div>

          {/* Actions Menu - Co-located with dialogs */}
          <div
            className={cn(
              'transition-all duration-200 flex items-center',
              isAdminRole ? 'invisible' : 'opacity-0 group-hover:opacity-100',
            )}
          >
            <PermissionGuard permission={USER_PERMISSIONS.UPDATE_ALL}>
              <UserActionsMenu
                user={user}
                onManagePermissions={handleManageClick}
                disabled={isAdminRole || isUpdatingRole}
              />
            </PermissionGuard>
          </div>
        </div>

        {/* Metadata Row */}
        <div className="flex items-center justify-between text-xs text-tertiary">
          <span>Joined {joinedDate}</span>
        </div>
      </article>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for optimal re-renders
    return (
      prevProps.user._id === nextProps.user._id &&
      prevProps.user.name === nextProps.user.name &&
      prevProps.user.email === nextProps.user.email &&
      prevProps.user.role === nextProps.user.role &&
      prevProps.user.isVerified === nextProps.user.isVerified &&
      prevProps.user.isDeleted === nextProps.user.isDeleted &&
      prevProps.onManagePermissions === nextProps.onManagePermissions
    );
  },
);

export default UserCard;
