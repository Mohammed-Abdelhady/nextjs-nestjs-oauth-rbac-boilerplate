'use client';

import { memo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Settings, MoreHorizontal, UserCheck, UserX, Trash2, Loader2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserActions } from '../hooks/useUserActions';
import { EditUserDialog } from './EditUserDialog';

export interface UserActionsMenuUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  isDeleted: boolean;
}

export interface UserActionsMenuProps {
  /** User data */
  user: UserActionsMenuUser;
  /** Callback when manage permissions is clicked */
  onManagePermissions?: () => void;
  /** Whether actions are disabled */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

type ConfirmActionType = 'activate' | 'deactivate' | 'delete' | null;

/**
 * UserActionsMenu - Dropdown menu with user actions and co-located dialogs.
 *
 * Features:
 * - Edit, Manage Permissions, Activate/Deactivate, Delete actions
 * - Co-located confirmation dialogs for destructive actions
 * - Co-located edit dialog
 * - Loading states for async operations
 * - Role-based action visibility
 *
 * @example
 * ```tsx
 * <UserActionsMenu
 *   user={user}
 *   onManagePermissions={() => openPermissionsDialog(user._id)}
 * />
 * ```
 */
export const UserActionsMenu = memo(function UserActionsMenu({
  user,
  onManagePermissions,
  disabled = false,
  className,
}: UserActionsMenuProps) {
  const [confirmAction, setConfirmAction] = useState<ConfirmActionType>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { handleStatusChange, handleDelete, isLoading } = useUserActions();

  const isNormalUser = user.role === 'user';

  // Handle confirmation action
  const handleConfirm = useCallback(async () => {
    let success = false;

    if (confirmAction === 'activate') {
      success = await handleStatusChange(user._id, true, user.name);
    } else if (confirmAction === 'deactivate') {
      success = await handleStatusChange(user._id, false, user.name);
    } else if (confirmAction === 'delete') {
      success = await handleDelete(user._id, user.name);
    }

    if (success) {
      setConfirmAction(null);
    }
  }, [confirmAction, handleStatusChange, handleDelete, user._id, user.name]);

  // Get dialog content based on action type
  const getDialogContent = () => {
    switch (confirmAction) {
      case 'activate':
        return {
          title: 'Activate User?',
          description: (
            <>
              Are you sure you want to activate <strong>{user.name}</strong>? This will restore
              their access to the system.
            </>
          ),
          confirmText: 'Activate',
          destructive: false,
        };
      case 'deactivate':
        return {
          title: 'Deactivate User?',
          description: (
            <>
              Are you sure you want to deactivate <strong>{user.name}</strong>? They will lose
              access to the system but their account can be restored later.
            </>
          ),
          confirmText: 'Deactivate',
          destructive: false,
        };
      case 'delete':
        return {
          title: 'Delete User?',
          description: (
            <>
              Are you sure you want to delete <strong>{user.name}</strong>? This will permanently
              remove their account and all associated data. This action cannot be undone.
            </>
          ),
          confirmText: 'Delete',
          destructive: true,
        };
      default:
        return { title: '', description: '', confirmText: '', destructive: false };
    }
  };

  const dialogContent = getDialogContent();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 px-3 gap-1.5 text-xs font-medium',
              'border border-transparent hover:border-border',
              'transition-all duration-200',
              className,
            )}
            disabled={disabled || isLoading}
            data-testid={`user-actions-menu-${user._id}`}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <span>Actions</span>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {/* Full menu for non-user roles (support, manager, etc.) */}
          {!isNormalUser && (
            <>
              <DropdownMenuItem
                onClick={() => setEditDialogOpen(true)}
                data-testid={`edit-user-${user._id}`}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit User
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onManagePermissions}
                data-testid={`manage-permissions-${user._id}`}
              >
                <Settings className="mr-2 h-4 w-4" />
                Manage Permissions
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Activate/Deactivate - available for all non-admin users */}
          {user.isDeleted ? (
            <DropdownMenuItem
              onClick={() => setConfirmAction('activate')}
              data-testid={`activate-user-${user._id}`}
            >
              <UserCheck className="mr-2 h-4 w-4 text-green-600 dark:text-green-400" />
              <span>Activate User</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setConfirmAction('deactivate')}
              data-testid={`deactivate-user-${user._id}`}
            >
              <UserX className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Deactivate User</span>
            </DropdownMenuItem>
          )}

          {/* Delete - only for non-user roles */}
          {!isNormalUser && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmAction('delete')}
                className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                data-testid={`delete-user-${user._id}`}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete User</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Co-located Edit Dialog */}
      <EditUserDialog
        userId={user._id}
        currentName={user.name}
        currentEmail={user.email}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Co-located Confirmation Dialog */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent data-testid="user-action-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogContent.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading}
              className={cn(
                dialogContent.destructive && 'bg-red-600 hover:bg-red-700 focus:ring-red-600',
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                dialogContent.confirmText
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

export default UserActionsMenu;
