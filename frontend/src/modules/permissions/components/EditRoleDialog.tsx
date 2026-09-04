'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateRoleMutation, type Role } from '../api/rolesApi';
import { PermissionSelector } from './PermissionSelector';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/apiError';

export interface EditRoleDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback when dialog should close
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Role to edit
   */
  role: Role | null;

  /**
   * Callback when role is successfully updated
   */
  onSuccess?: () => void;
}

interface EditRoleFormProps {
  role: Role;
  isLoading: boolean;
  onSubmit: (data: { name: string; description: string; permissions: string[] }) => void;
  onCancel: () => void;
}

/**
 * Inner form component - remounts when role changes via key prop
 */
function EditRoleForm({ role, isLoading, onSubmit, onCancel }: EditRoleFormProps) {
  // Initialize directly from props - component remounts when role.id changes
  const [name, setName] = useState(role.name || '');
  const [description, setDescription] = useState(role.description || '');
  const [permissions, setPermissions] = useState<string[]>(role.permissions || []);

  const isProtected = role.isProtected;
  const isBaseRole = role.slug === 'user' || role.slug === 'admin';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    if (permissions.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }

    onSubmit({ name, description, permissions });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Edit Role</DialogTitle>
        <DialogDescription>
          {isBaseRole
            ? 'This is a base system role. Only permissions can be modified.'
            : isProtected
              ? 'This is a protected system role. Some fields cannot be modified.'
              : 'Update the role name, description, and permissions.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-6">
        {/* Base Role Warning */}
        {isBaseRole && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Base Role:</strong> User and Admin roles are fundamental to the system. Name
              and description cannot be modified, but you can update permissions.
            </p>
          </div>
        )}

        {/* Protected Role Warning */}
        {isProtected && !isBaseRole && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <strong>Protected Role:</strong> This role cannot be deleted and its core permissions
              are managed by the system.
            </p>
          </div>
        )}

        {/* Role Name */}
        <div className="space-y-2">
          <Label htmlFor="edit-role-name">
            Role Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="edit-role-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading || isProtected || isBaseRole}
            required
            data-testid="edit-role-name-input"
          />
          {(isProtected || isBaseRole) && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isBaseRole
                ? 'Base role names cannot be changed'
                : 'Protected role names cannot be changed'}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="edit-role-description">Description</Label>
          <Textarea
            id="edit-role-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this role is for..."
            rows={3}
            disabled={isLoading || isBaseRole}
            data-testid="edit-role-description-input"
          />
          {isBaseRole && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Base role descriptions cannot be changed
            </p>
          )}
        </div>

        {/* Permissions */}
        <div className="space-y-2">
          <Label>
            Permissions <span className="text-red-500">*</span>
          </Label>
          <PermissionSelector
            selectedPermissions={permissions}
            onChange={setPermissions}
            disabled={isLoading}
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          data-testid="cancel-button"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="save-role-button">
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Dialog for editing an existing role.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * const [selectedRole, setSelectedRole] = useState<Role | null>(null);
 *
 * <EditRoleDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   role={selectedRole}
 *   onSuccess={() => console.log('Role updated!')}
 * />
 * ```
 */
export function EditRoleDialog({ open, onOpenChange, role, onSuccess }: EditRoleDialogProps) {
  const [updateRole, { isLoading }] = useUpdateRoleMutation();

  const handleSubmit = async (data: {
    name: string;
    description: string;
    permissions: string[];
  }) => {
    if (!role) return;

    const isBaseRole = role.slug === 'user' || role.slug === 'admin';

    try {
      // For base roles, only update permissions
      const updateData = isBaseRole
        ? { permissions: data.permissions }
        : {
            name: data.name.trim(),
            description: data.description.trim() || undefined,
            permissions: data.permissions,
          };

      await updateRole({
        idOrSlug: role.id,
        data: updateData,
      }).unwrap();

      toast.success('Role updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const parsed = parseApiError(error);
      toast.error(parsed.message || 'Failed to update role');
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {/* Key forces remount when role changes, reinitializing state */}
        <EditRoleForm
          key={role.id}
          role={role}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
