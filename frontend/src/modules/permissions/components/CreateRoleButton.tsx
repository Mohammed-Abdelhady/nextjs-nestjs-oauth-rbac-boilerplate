'use client';

import { useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

// Lazy load the dialog for code splitting
const CreateRoleDialog = lazy(() =>
  import('./CreateRoleDialog').then((mod) => ({
    default: mod.CreateRoleDialog,
  })),
);

export interface CreateRoleButtonProps {
  /** Optional callback when role is created successfully */
  onSuccess?: () => void;
  /** Additional className for the button */
  className?: string;
}

/**
 * CreateRoleButton - Button with co-located create role dialog.
 *
 * Implements the co-location pattern where the button manages its own
 * dialog state internally. The dialog is lazy-loaded for performance.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <CreateRoleButton />
 *
 * // With success callback
 * <CreateRoleButton onSuccess={() => refetchRoles()} />
 * ```
 */
export function CreateRoleButton({ onSuccess, className }: CreateRoleButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className={className} data-testid="create-role-button">
        <Plus className="me-2 h-4 w-4" />
        Create Role
      </Button>

      {/* Co-located dialog with lazy loading */}
      {open && (
        <Suspense fallback={<div />}>
          <CreateRoleDialog open={open} onOpenChange={setOpen} onSuccess={onSuccess} />
        </Suspense>
      )}
    </>
  );
}

export default CreateRoleButton;
