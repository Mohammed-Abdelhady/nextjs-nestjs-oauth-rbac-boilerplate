'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormPassword, PasswordRules } from '@/components/forms';
import { useChangePasswordMutation } from '@/modules/auth/store';
import { parseApiError } from '@/lib/apiError';
import {
  changePasswordSchema,
  type ChangePasswordFormData,
} from '@/lib/validations/changePassword';

/**
 * ChangePasswordCard Component
 * Allows users to change their password from the Settings page
 */
export function ChangePasswordCard() {
  const t = useTranslations('settings.password');
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }).unwrap();

      toast.success(t('success'));
      form.reset();
    } catch (error) {
      const parsed = parseApiError(error);
      toast.error(parsed.message || 'Failed to change password');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            data-testid="change-password-form"
          >
            <FormPassword<ChangePasswordFormData>
              name="currentPassword"
              label={t('currentPassword')}
              placeholder="********"
              disabled={isLoading}
              data-testid="current-password-input"
            />

            <FormPassword<ChangePasswordFormData>
              name="newPassword"
              label={t('newPassword')}
              placeholder="********"
              disabled={isLoading}
              data-testid="new-password-input"
            />

            <PasswordRules name="newPassword" className="mt-2" />

            <FormPassword<ChangePasswordFormData>
              name="confirmPassword"
              label={t('confirmPassword')}
              placeholder="********"
              disabled={isLoading}
              data-testid="confirm-password-input"
            />

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              data-testid="change-password-submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('submit')}...
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
