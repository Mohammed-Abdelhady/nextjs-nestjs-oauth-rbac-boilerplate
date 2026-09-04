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
import { useCreateRoleMutation } from '../api/rolesApi';
import { PermissionSelector } from './PermissionSelector';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/apiError';

export interface CreateRoleDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback when dialog should close
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Callback when role is successfully created
   */
  onSuccess?: () => void;
}

/**
 * Dialog for creating a new role.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <CreateRoleDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   onSuccess={() => console.log('Role created!')}
 * />
 * ```
 */
export function CreateRoleDialog({ open, onOpenChange, onSuccess }: CreateRoleDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);

  const [createRole, { isLoading }] = useCreateRoleMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    if (permissions.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }

    try {
      await createRole({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions,
      }).unwrap();

      toast.success('Role created successfully');

      // Reset form
      setName('');
      setDescription('');
      setPermissions([]);

      // Close dialog
      onOpenChange(false);

      // Call success callback
      onSuccess?.();
    } catch (error: unknown) {
      const parsed = parseApiError(error);
      toast.error(parsed.message || 'Failed to create role');
    }
  };

  const handleCancel = () => {
    // Reset form
    setName('');
    setDescription('');
    setPermissions([]);

    // Close dialog
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Create a custom role with specific permissions. Roles can be assigned to users for
              access control.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* Role Name */}
            <div className="space-y-2">
              <Label htmlFor="role-name">
                Role Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Content Editor"
                disabled={isLoading}
                required
                data-testid="role-name-input"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                A unique name for this role (e.g., Content Editor, Moderator)
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this role is for..."
                rows={3}
                disabled={isLoading}
                data-testid="role-description-input"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Optional description of the role&apos;s purpose and responsibilities
              </p>
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
              onClick={handleCancel}
              disabled={isLoading}
              data-testid="cancel-button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} data-testid="create-role-button">
              {isLoading ? 'Creating...' : 'Create Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
