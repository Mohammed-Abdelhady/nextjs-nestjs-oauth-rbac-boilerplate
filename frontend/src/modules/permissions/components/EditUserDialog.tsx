'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { Loader2 } from 'lucide-react';
import { useUpdateUserMutation } from '@/store/api/userApi';
import { useToast } from '@/hooks/use-toast';
import { parseApiError } from '@/lib/apiError';

interface EditUserDialogProps {
  userId: string | null;
  currentName: string;
  currentEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditUserFormProps {
  initialName: string;
  initialEmail: string;
  isLoading: boolean;
  onSubmit: (data: { name: string; email: string }) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Inner form component - remounts when userId changes via key prop
 */
function EditUserForm({
  initialName,
  initialEmail,
  isLoading,
  onSubmit,
  onClose,
}: EditUserFormProps) {
  const t = useTranslations('users.editUser');
  // Initialize directly from props - component remounts when userId changes
  const [name, setName] = useState(initialName || '');
  const [email, setEmail] = useState(initialEmail || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = t('errors.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('errors.emailInvalid');
    }

    if (!name.trim()) {
      newErrors.name = t('errors.nameRequired');
    } else if (name.trim().length < 2) {
      newErrors.name = t('errors.nameMinLength');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const success = await onSubmit({ name: name.trim(), email: email.trim() });
    if (success) {
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name Field */}
      <div className="space-y-2">
        <Label
          htmlFor="edit-name"
          className="text-xs uppercase tracking-widest text-muted-foreground"
        >
          {t('name')}
        </Label>
        <Input
          id="edit-name"
          type="text"
          placeholder={t('namePlaceholder')}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
          }}
          disabled={isLoading}
          className={errors.name ? 'border-red-500' : ''}
          data-testid="edit-user-name-input"
        />
        {errors.name && (
          <p className="text-xs text-red-500" data-testid="name-error">
            {errors.name}
          </p>
        )}
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <Label
          htmlFor="edit-email"
          className="text-xs uppercase tracking-widest text-muted-foreground"
        >
          {t('email')}
        </Label>
        <Input
          id="edit-email"
          type="email"
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
          }}
          disabled={isLoading}
          className={errors.email ? 'border-red-500' : ''}
          data-testid="edit-user-email-input"
        />
        {errors.email && (
          <p className="text-xs text-red-500" data-testid="email-error">
            {errors.email}
          </p>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isLoading}
          data-testid="cancel-edit-user-button"
        >
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          data-testid="submit-edit-user-button"
        >
          {isLoading ? (
            <>
              <Loader2 className="me-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              {t('saving')}
            </>
          ) : (
            t('save')
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * EditUserDialog - Modal for editing user information
 *
 * Features:
 * - Edit user name and email
 * - Form validation
 * - Error handling
 * - Loading states
 *
 * @example
 * ```tsx
 * const [editUserId, setEditUserId] = useState<string | null>(null);
 * <EditUserDialog
 *   userId={editUserId}
 *   currentName="John Doe"
 *   currentEmail="john@example.com"
 *   open={!!editUserId}
 *   onOpenChange={(open) => !open && setEditUserId(null)}
 * />
 * ```
 */
export function EditUserDialog({
  userId,
  currentName,
  currentEmail,
  open,
  onOpenChange,
}: EditUserDialogProps) {
  const t = useTranslations('users.editUser');
  const [updateUser, { isLoading }] = useUpdateUserMutation();
  const { toast } = useToast();

  const handleSubmit = async (data: { name: string; email: string }): Promise<boolean> => {
    if (!userId) return false;

    // Check if nothing changed
    if (data.name === currentName && data.email === currentEmail) {
      toast.info(t('noChanges'));
      return true;
    }

    try {
      await updateUser({
        userId,
        name: data.name,
        email: data.email,
      }).unwrap();

      toast.success(t('success'));
      return true;
    } catch (error) {
      const parsed = parseApiError(error);
      toast.error(parsed.message || t('error'));
      return false;
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!userId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="edit-user-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">{t('title')}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        {/* Key forces remount when userId changes, reinitializing state */}
        <EditUserForm
          key={userId}
          initialName={currentName}
          initialEmail={currentEmail}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onClose={handleClose}
        />
      </DialogContent>
    </Dialog>
  );
}
