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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { PasswordVisibilityToggle } from '@/components/forms';
import { useCreateUserMutation } from '@/store/api/userApi';
import { useListRolesQuery } from '../api/rolesApi';
import { useToast } from '@/hooks/use-toast';
import { parseApiError } from '@/lib/apiError';
import { validateCreateUserForm } from '../utils/createUserValidation';

export interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional callback when user is created successfully */
  onSuccess?: () => void;
}

/**
 * CreateUserDialog - Modal for creating new users
 *
 * Features:
 * - Email, name, password input fields
 * - Role selector (non-protected roles only)
 * - Form validation
 * - Error handling
 * - Loading states
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * <CreateUserDialog open={open} onOpenChange={setOpen} />
 * ```
 */
export function CreateUserDialog({ open, onOpenChange, onSuccess }: CreateUserDialogProps) {
  const t = useTranslations('users.createUser');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [createUser, { isLoading }] = useCreateUserMutation();
  const { data: rolesData, isLoading: isLoadingRoles } = useListRolesQuery(undefined);
  const { toast } = useToast();

  const roles = rolesData?.roles || [];
  const availableRoles = roles.filter((r) => !r.isProtected);

  const validateForm = (): boolean => {
    const newErrors = validateCreateUserForm({ email, name, password, role }, tValidation);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await createUser({
        email: email.trim(),
        name: name.trim(),
        password,
        role,
      }).unwrap();

      toast.success(t('success'));
      handleClose();
      onSuccess?.();
    } catch (error) {
      const parsed = parseApiError(error);
      toast.error(parsed.message || t('error'));
    }
  };

  const handleClose = () => {
    setEmail('');
    setName('');
    setPassword('');
    setRole('user');
    setShowPassword(false);
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="create-user-dialog">
        <DialogHeader>
          <DialogTitle className="text-2xl font-light tracking-tight">{t('title')}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground/60">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-xs uppercase tracking-widest text-muted-foreground/60"
            >
              {t('email')}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              }}
              disabled={isLoading}
              className={errors.email ? 'border-red-500' : ''}
              data-testid="create-user-email-input"
            />
            {errors.email && (
              <p className="text-xs text-red-500" data-testid="email-error">
                {errors.email}
              </p>
            )}
          </div>

          {/* Name Field */}
          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="text-xs uppercase tracking-widest text-muted-foreground/60"
            >
              {t('name')}
            </Label>
            <Input
              id="name"
              type="text"
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              disabled={isLoading}
              className={errors.name ? 'border-red-500' : ''}
              data-testid="create-user-name-input"
            />
            {errors.name && (
              <p className="text-xs text-red-500" data-testid="name-error">
                {errors.name}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-xs uppercase tracking-widest text-muted-foreground/60"
            >
              {t('password')}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                disabled={isLoading}
                className={errors.password ? 'border-red-500 pe-10' : 'pe-10'}
                data-testid="create-user-password-input"
              />
              <PasswordVisibilityToggle
                showPassword={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
                testId="create-user-password-toggle"
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-500" data-testid="password-error">
                {errors.password}
              </p>
            )}
          </div>

          {/* Role Field */}
          <div className="space-y-2">
            <Label
              htmlFor="role"
              className="text-xs uppercase tracking-widest text-muted-foreground/60"
            >
              {t('role')}
            </Label>
            <Select
              value={role}
              onValueChange={(value) => {
                setRole(value);
                if (errors.role) setErrors((prev) => ({ ...prev, role: '' }));
              }}
              disabled={isLoading || isLoadingRoles}
            >
              <SelectTrigger
                id="role"
                className={errors.role ? 'border-red-500' : ''}
                data-testid="create-user-role-select"
              >
                {isLoadingRoles ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SelectValue placeholder={t('selectRole')} />
                )}
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r.id} value={r.slug} data-testid={`role-option-${r.slug}`}>
                    <div className="flex items-center gap-2">
                      <span>{r.name}</span>
                      {r.isSystemRole && (
                        <span className="text-xs text-muted-foreground/50">{t('systemRole')}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-xs text-red-500" data-testid="role-error">
                {errors.role}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
              data-testid="cancel-create-user-button"
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading} data-testid="submit-create-user-button">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
