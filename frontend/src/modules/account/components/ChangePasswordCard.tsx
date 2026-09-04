'use client';

import { useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormPassword, PasswordRules, SubmitButton } from '@/components/forms';
import { useChangePasswordMutation } from '@/modules/auth/store';
import { parseApiError } from '@/lib/apiError';
import {
  createChangePasswordSchema,
  type ChangePasswordFormData,
} from '@/lib/validations/changePassword';

/**
 * ChangePasswordCard Component
 * Allows users to change their password from the Settings page
 */
export function ChangePasswordCard() {
  const t = useTranslations('settings.password');
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const schema = useMemo(() => createChangePasswordSchema(t), [t]);

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(schema),
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
      toast.error(parsed.message || t('error'));
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

            <SubmitButton
              isLoading={isLoading}
              className="h-10 mt-0 w-full py-2"
              testId="change-password-submit"
            >
              {t('submit')}
            </SubmitButton>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
