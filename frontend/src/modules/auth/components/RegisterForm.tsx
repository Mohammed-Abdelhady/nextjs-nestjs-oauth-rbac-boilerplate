'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { z } from 'zod';
import { FormProvider } from 'react-hook-form';
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import {
  FormInput,
  FormPassword,
  FormRootError,
  PasswordRules,
  SubmitButton,
} from '@/components/forms';
import { useRegisterMutation } from '../store/authApi';
import { zodEmail, zodPassword, zodName } from '@/lib/validations';
import { UserPlus, LogIn } from 'lucide-react';
import { IconLinkButton } from '@/components/ui/icon-link-button';
import { useCallback, useMemo } from 'react';
import { toast } from '@/lib/toast';
import { parseApiError } from '@/lib/apiError';
import { OAuthButtons, OAuthDivider } from '@/modules/oauth';

/**
 * Registration form validation schema using centralized validators
 */
const createRegisterSchema = (t: (key: string) => string) =>
  z.object({
    name: zodName({
      required: true,
      messages: {
        required: t('errors.nameRequired'),
        min: t('errors.nameMinLength'),
        max: t('errors.nameMaxLength'),
      },
    }),
    email: zodEmail({
      required: true,
      messages: {
        required: t('errors.emailRequired'),
        invalid: t('errors.emailInvalid'),
      },
    }),
    password: zodPassword({
      required: true,
      min: 8,
      messages: {
        required: t('errors.passwordRequired'),
        min: t('errors.passwordMinLength'),
      },
    }),
  });

type RegisterFormData = z.infer<ReturnType<typeof createRegisterSchema>>;

/**
 * RegisterForm component with validation and API integration
 * Optimized for performance with memoization and minimal re-renders
 *
 * @example
 * <RegisterForm />
 */
export function RegisterForm() {
  const t = useTranslations('auth.register');
  const tToast = useTranslations('toast');
  const router = useRouter();
  const [register, { isLoading }] = useRegisterMutation();

  // Memoize schema creation when translation function changes
  const registerSchema = useMemo(() => createRegisterSchema(t), [t]);

  // Initialize form with validation
  const form = useFormWithValidation({
    schema: registerSchema,
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
    mode: 'onBlur',
  });

  const {
    handleSubmit,
    formState: { errors },
    setError,
  } = form;

  // Memoize submit handler to prevent recreating on every render
  const onSubmit = useCallback(
    async (data: RegisterFormData) => {
      try {
        const result = await register({
          name: data.name,
          email: data.email,
          password: data.password,
        }).unwrap();

        // Successful registration - show toast and redirect to activation
        toast.success(tToast('success.registrationSuccess'));
        router.push(`/auth/activate?email=${encodeURIComponent(result.data.email)}`);
      } catch (err: unknown) {
        const parsed = parseApiError(err);
        let errorMessage = t('errors.serverError');

        if (parsed.code === 'EMAIL_ALREADY_EXISTS' || parsed.message?.includes('already')) {
          errorMessage = t('errors.emailExists');
        } else if (parsed.message) {
          errorMessage = parsed.message;
        }

        setError('root', {
          type: 'manual',
          message: errorMessage,
        });
        toast.error(errorMessage);
      }
    },
    [register, router, setError, t, tToast],
  );

  return (
    <section className="mt-12 flex flex-col items-center" aria-labelledby="register-heading">
      {/* Title */}
      <h1
        id="register-heading"
        className="text-2xl xl:text-3xl font-extrabold text-foreground"
        data-testid="register-title"
      >
        {t('title')}
      </h1>

      <div className="w-full flex-1 mt-8">
        {/* Sign In Link */}
        <div className="flex flex-col items-center">
          <IconLinkButton
            href="/auth/login"
            icon={LogIn}
            variant="secondary"
            testId="signin-link"
            aria-label={t('signIn')}
          >
            {t('signIn')}
          </IconLinkButton>
        </div>

        {/* OAuth Buttons */}
        <div className="my-6">
          <OAuthButtons mode="signin" />
        </div>

        {/* Divider */}
        <OAuthDivider />

        {/* Registration Form */}
        <FormProvider {...form}>
          <form
            className="mx-auto max-w-xs relative"
            onSubmit={handleSubmit(onSubmit)}
            data-testid="register-form"
            noValidate
            aria-labelledby="register-heading"
            aria-describedby={errors.root?.message ? 'register-error' : undefined}
          >
            <FormRootError
              id="register-error"
              error={errors.root?.message}
              testId="register-error"
            />

            {/* Name Input */}
            <FormInput
              name="name"
              type="text"
              label={t('name')}
              placeholder="Jane Doe"
              autoComplete="name"
              disabled={isLoading}
              autoFocus
            />

            {/* Email Input */}
            <FormInput
              name="email"
              type="email"
              label={t('email')}
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isLoading}
              className="mt-5"
            />

            {/* Password Input */}
            <FormPassword
              name="password"
              label={t('password')}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isLoading}
              showToggle={true}
              className="mt-5"
            />

            <PasswordRules name="password" className="mt-3" />

            {/* Submit Button */}
            <SubmitButton isLoading={isLoading} icon={UserPlus} testId="register-submit">
              {t('submit')}
            </SubmitButton>
          </form>
        </FormProvider>
      </div>
    </section>
  );
}
