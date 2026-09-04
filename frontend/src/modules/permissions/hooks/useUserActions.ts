import { useCallback } from 'react';
import {
  useUpdateUserStatusMutation,
  useUpdateUserRoleMutation,
  useDeleteUserMutation,
} from '@/modules/users/api/usersApi';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/modules/auth/utils/authHelpers';

/**
 * Return type for the useUserActions hook.
 */
export interface UseUserActionsReturn {
  /** Update user role */
  handleRoleChange: (userId: string, newRole: string) => Promise<void>;
  /** Activate or deactivate user */
  handleStatusChange: (userId: string, isActive: boolean, userName: string) => Promise<boolean>;
  /** Delete user */
  handleDelete: (userId: string, userName: string) => Promise<boolean>;
  /** Whether any action is loading */
  isLoading: boolean;
  /** Whether status update is loading */
  isUpdatingStatus: boolean;
  /** Whether role update is loading */
  isUpdatingRole: boolean;
  /** Whether delete is loading */
  isDeleting: boolean;
}

/**
 * useUserActions - Hook for user CRUD operations with toast notifications.
 *
 * Extracts user management logic from components to keep them focused on rendering.
 * Handles error messages and success toasts consistently.
 *
 * @returns Object with action handlers and loading states
 *
 * @example
 * ```tsx
 * function UserCard({ user }) {
 *   const { handleRoleChange, handleStatusChange, handleDelete, isLoading } = useUserActions();
 *
 *   const onActivate = async () => {
 *     const success = await handleStatusChange(user._id, true, user.name);
 *     if (success) {
 *       closeDialog();
 *     }
 *   };
 *
 *   return (
 *     <Button onClick={onActivate} disabled={isLoading}>
 *       Activate
 *     </Button>
 *   );
 * }
 * ```
 */
export function useUserActions(): UseUserActionsReturn {
  const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdateUserStatusMutation();
  const [updateRole, { isLoading: isUpdatingRole }] = useUpdateUserRoleMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
  const { toast } = useToast();

  /**
   * Update user role.
   */
  const handleRoleChange = useCallback(
    async (userId: string, newRole: string) => {
      try {
        await updateRole({ userId, role: newRole }).unwrap();
        toast.success('Role updated successfully');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [updateRole, toast],
  );

  /**
   * Activate or deactivate user.
   * Returns true on success, false on failure.
   */
  const handleStatusChange = useCallback(
    async (userId: string, isActive: boolean, userName: string): Promise<boolean> => {
      try {
        await updateStatus({ userId, isActive }).unwrap();
        toast.success(
          isActive ? `${userName} activated successfully` : `${userName} deactivated successfully`,
        );
        return true;
      } catch (error) {
        toast.error(getErrorMessage(error));
        return false;
      }
    },
    [updateStatus, toast],
  );

  /**
   * Delete user.
   * Returns true on success, false on failure.
   */
  const handleDelete = useCallback(
    async (userId: string, userName: string): Promise<boolean> => {
      try {
        await deleteUser(userId).unwrap();
        toast.success(`${userName} deleted successfully`);
        return true;
      } catch (error) {
        toast.error(getErrorMessage(error));
        return false;
      }
    },
    [deleteUser, toast],
  );

  const isLoading = isUpdatingStatus || isUpdatingRole || isDeleting;

  return {
    handleRoleChange,
    handleStatusChange,
    handleDelete,
    isLoading,
    isUpdatingStatus,
    isUpdatingRole,
    isDeleting,
  };
}

export default useUserActions;
