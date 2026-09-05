'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { FormProvider } from 'react-hook-form';
import { LogIn } from 'lucide-react';
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import { FormInput, FormPassword, FormRootError, SubmitButton } from '@/components/forms';
import { zodEmail } from '@/lib/validations';
import { Link } from '@/i18n/navigation';
import { useCompleteSignIn } from '@/modules/auth/hooks/useCompleteSignIn';
import { useLoginMutation } from '@/modules/auth/store/authApi';
import { translateAuthError } from '@/modules/auth/utils/authHelpers';
import type { AuthMethodFormProps } from '../types';

/**
 * Sign-in schema. The minimum length is only there to catch an empty box; the
 * strength rules belong to registration, not to an account that already exists.
 */
const createPasswordSignInSchema = (t: (key: string) => string) =>
  z.object({
    email: zodEmail({
      required: true,
      messages: { required: t('errors.emailRequired'), invalid: t('errors.emailInvalid') },
    }),
    password: z
      .string({ required_error: t('errors.passwordRequired') })
      .min(1, t('errors.passwordRequired'))
      .min(6, t('errors.passwordMinLength')),
  });

type PasswordSignInData = z.infer<ReturnType<typeof createPasswordSignInSchema>>;

/** Email and password sign-in. Hands a challenged account to /auth/2fa. */
export function PasswordSignInForm({ redirect }: AuthMethodFormProps) {
  const t = useTranslations('auth.login');
  const [login, { isLoading }] = useLoginMutation();
  const completeSignIn = useCompleteSignIn();

  const schema = useMemo(() => createPasswordSignInSchema(t), [t]);
  const form = useFormWithValidation({
    schema,
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const {
    handleSubmit,
    formState: { errors },
    setError,
  } = form;

  const onSubmit = useCallback(
    async (data: PasswordSignInData) => {
      try {
        const response = await login({ email: data.email, password: data.password }).unwrap();
        await completeSignIn(response, redirect);
      } catch (err) {
        setError('root', { type: 'manual', message: translateAuthError(err, t) });
      }
    },
    [completeSignIn, login, redirect, setError, t],
  );

  return (
    <FormProvider {...form}>
      <form
        className="relative mx-auto max-w-xs"
        onSubmit={handleSubmit(onSubmit)}
        data-testid="login-form"
        noValidate
        aria-labelledby="login-heading"
        aria-describedby={errors.root?.message ? 'login-error' : undefined}
      >
        <FormRootError id="login-error" error={errors.root?.message} testId="login-error" />

        <FormInput
          name="email"
          type="email"
          label={t('email')}
          placeholder="name@example.com"
          autoComplete="email"
          disabled={isLoading}
          autoFocus
          data-testid="login-email-input"
        />

        <FormPassword
          name="password"
          label={t('password')}
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={isLoading}
          showToggle={false}
          className="mt-5"
          data-testid="login-password-input"
        />

        <SubmitButton isLoading={isLoading} icon={LogIn} testId="login-submit">
          {t('submit')}
        </SubmitButton>

        <Link
          href="/auth/forgot-password"
          className="no-underline hover:underline text-primary text-md text-end absolute end-0 mt-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
          data-testid="forgot-password-link"
          aria-label={t('forgotPassword')}
        >
          {t('forgotPassword')}
        </Link>
      </form>
    </FormProvider>
  );
}
