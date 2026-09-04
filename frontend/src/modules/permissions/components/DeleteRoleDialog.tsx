'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteRoleMutation, type Role } from '../api/rolesApi';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/apiError';

export interface DeleteRoleDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback when dialog should close
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Role to delete
   */
  role: Role | null;

  /**
   * Callback when role is successfully deleted
   */
  onSuccess?: () => void;
}

/**
 * Dialog for confirming role deletion.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * const [selectedRole, setSelectedRole] = useState<Role | null>(null);
 *
 * <DeleteRoleDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   role={selectedRole}
 *   onSuccess={() => console.log('Role deleted!')}
 * />
 * ```
 */
export function DeleteRoleDialog({ open, onOpenChange, role, onSuccess }: DeleteRoleDialogProps) {
  const [deleteRole, { isLoading }] = useDeleteRoleMutation();

  const handleDelete = async () => {
    if (!role) return;

    try {
      await deleteRole(role.id).unwrap();

      toast.success('Role deleted successfully');

      // Close dialog
      onOpenChange(false);

      // Call success callback
      onSuccess?.();
    } catch (error: unknown) {
      const parsed = parseApiError(error);
      toast.error(parsed.message || 'Failed to delete role');
    }
  };

  if (!role) return null;

  const isProtected = role.isProtected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Role</DialogTitle>
          <DialogDescription>
            {isProtected
              ? 'This role is protected and cannot be deleted.'
              : 'Are you sure you want to delete this role?'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isProtected ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <strong>Protected Role:</strong> The <strong>{role.name}</strong> role is a system
                role and cannot be deleted. It is required for the application to function
                correctly.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Role Name
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{role.name}</dd>
                  </div>
                  {role.description && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Description
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {role.description}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Permissions
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                      {role.permissions.length} permission
                      {role.permissions.length !== 1 ? 's' : ''}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                <p className="text-sm text-red-900 dark:text-red-100">
                  <strong>Warning:</strong> This action cannot be undone. Users with this role will
                  need to be reassigned to another role before deletion.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            data-testid="cancel-button"
          >
            Cancel
          </Button>
          {!isProtected && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
              data-testid="delete-role-button"
            >
              {isLoading ? 'Deleting...' : 'Delete Role'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
