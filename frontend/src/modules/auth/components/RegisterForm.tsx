'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { z } from 'zod';
import { FormProvider } from 'react-hook-form';
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import { FormInput, FormPassword } from '@/components/forms';
import { useRegisterMutation } from '../store/authApi';
import { zodEmail, zodPassword, zodName } from '@/lib/validations';
import { UserPlus, LogIn } from 'lucide-react';
import { IconLinkButton } from '@/components/ui/icon-link-button';
import { Button } from '@/components/ui/button';
import { useCallback, useMemo } from 'react';
import { toast } from '@/lib/toast';
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
        // Handle API errors
        const error = err as { data?: { error?: { code?: string; message?: string } } };
        let errorMessage = t('errors.serverError');

        const errorCode = error.data?.error?.code;
        const errorMsg = error.data?.error?.message;

        if (errorCode === 'EMAIL_ALREADY_EXISTS' || errorMsg?.includes('already')) {
          errorMessage = t('errors.emailExists');
        } else if (errorMsg) {
          errorMessage = errorMsg;
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
            {/* Global Error Alert - Live Region */}
            {errors.root?.message && (
              <div
                id="register-error"
                className="mb-4 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                data-testid="register-error"
              >
                {errors.root.message}
              </div>
            )}

            {/* Name Input */}
            <FormInput
              name="name"
              type="text"
              placeholder={t('name')}
              autoComplete="name"
              disabled={isLoading}
              autoFocus
              aria-label={t('name')}
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />

            {/* Email Input */}
            <FormInput
              name="email"
              type="email"
              placeholder={t('email')}
              autoComplete="email"
              disabled={isLoading}
              className="mt-5"
              aria-label={t('email')}
              aria-required="true"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />

            {/* Password Input */}
            <FormPassword
              name="password"
              placeholder={t('password')}
              autoComplete="new-password"
              disabled={isLoading}
              showToggle={true}
              className="mt-5"
              aria-label={t('password')}
              aria-required="true"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="h-14 mt-5 tracking-wide font-semibold w-full py-4 rounded-lg transition-all duration-300 ease-in-out flex items-center justify-center"
              data-testid="register-submit"
              aria-label={isLoading ? `${t('submit')}...` : t('submit')}
              aria-busy={isLoading}
            >
              <UserPlus className="w-6 h-6 -ms-2" aria-hidden="true" />
              <span className="ms-3">{isLoading ? `${t('submit')}...` : t('submit')}</span>
            </Button>
          </form>
        </FormProvider>
      </div>
    </section>
  );
}
