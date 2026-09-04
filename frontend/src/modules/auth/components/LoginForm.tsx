'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { FormProvider } from 'react-hook-form';
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import { FormInput, FormPassword, FormRootError, SubmitButton } from '@/components/forms';
import { useLoginMutation } from '../store/authApi';
import { translateAuthError, getRedirectPath } from '../utils/authHelpers';
import { zodEmail } from '@/lib/validations';
import { Link, useRouter } from '@/i18n/navigation';
import { UserPlus, LogIn } from 'lucide-react';
import { IconLinkButton } from '@/components/ui/icon-link-button';
import { useCallback, useMemo } from 'react';
import { OAuthButtons, OAuthDivider } from '@/modules/oauth';

/**
 * Login form validation schema using centralized validators
 * Note: Login doesn't use zodPassword because it doesn't enforce
 * strong password rules (uppercase, lowercase, number) for existing users
 */
const createLoginSchema = (t: (key: string) => string) =>
  z.object({
    email: zodEmail({
      required: true,
      messages: {
        required: t('errors.emailRequired'),
        invalid: t('errors.emailInvalid'),
      },
    }),
    password: z
      .string({ required_error: t('errors.passwordRequired') })
      .min(1, t('errors.passwordRequired'))
      .min(6, t('errors.passwordMinLength')),
  });

type LoginFormData = z.infer<ReturnType<typeof createLoginSchema>>;

/**
 * LoginForm component with validation and API integration
 * Optimized for performance with memoization and minimal re-renders
 *
 * @example
 * <LoginForm />
 */
export function LoginForm() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login, { isLoading }] = useLoginMutation();

  // Memoize schema creation when translation function changes
  const loginSchema = useMemo(() => createLoginSchema(t), [t]);

  // Initialize form with validation
  const form = useFormWithValidation({
    schema: loginSchema,
    defaultValues: {
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
    async (data: LoginFormData) => {
      try {
        const response = await login({
          email: data.email,
          password: data.password,
        }).unwrap();

        // Determine redirect path based on user permissions
        const explicitRedirect = searchParams.get('redirect');
        let defaultPath = '/dashboard';

        // Redirect to admin dashboard if user has admin-level permissions
        if (!explicitRedirect && response.user) {
          const hasAdminPermissions =
            response.user.permissions.includes('*') || // Wildcard permission
            response.user.permissions.includes('users:list:all') ||
            response.user.permissions.includes('roles:manage:all') ||
            response.user.permissions.includes('permissions:manage:all');

          if (hasAdminPermissions) {
            defaultPath = '/admin/dashboard';
          }
        }

        const redirectPath = getRedirectPath(explicitRedirect, defaultPath);
        router.push(redirectPath);
      } catch (err) {
        // Handle API errors with translation
        const errorMessage = translateAuthError(err, t);
        setError('root', {
          type: 'manual',
          message: errorMessage,
        });
        // Error toast is automatically shown by errorInterceptor middleware
      }
    },
    [login, searchParams, router, setError, t],
  );

  return (
    <section className="mt-12 flex flex-col items-center" aria-labelledby="login-heading">
      {/* Title */}
      <h1
        id="login-heading"
        className="text-2xl xl:text-3xl font-extrabold text-foreground"
        data-testid="login-title"
      >
        {t('title')}
      </h1>

      <div className="w-full flex-1 mt-8">
        {/* Sign Up Link */}
        <div className="flex flex-col items-center">
          <IconLinkButton
            href="/auth/register"
            icon={UserPlus}
            variant="secondary"
            testId="signup-link"
            aria-label={t('signUp')}
          >
            {t('signUp')}
          </IconLinkButton>
        </div>

        {/* OAuth Buttons */}
        <div className="my-6">
          <OAuthButtons mode="signin" />
        </div>

        {/* Divider */}
        <OAuthDivider />

        {/* Login Form */}
        <FormProvider {...form}>
          <form
            className="mx-auto max-w-xs relative"
            onSubmit={handleSubmit(onSubmit)}
            data-testid="login-form"
            noValidate
            aria-labelledby="login-heading"
            aria-describedby={errors.root?.message ? 'login-error' : undefined}
          >
            <FormRootError id="login-error" error={errors.root?.message} testId="login-error" />

            {/* Email Input */}
            <FormInput
              name="email"
              type="email"
              label={t('email')}
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isLoading}
              autoFocus
            />

            {/* Password Input */}
            <FormPassword
              name="password"
              label={t('password')}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              showToggle={false}
              className="mt-5"
            />

            {/* Submit Button */}
            <SubmitButton isLoading={isLoading} icon={LogIn} testId="login-submit">
              {t('submit')}
            </SubmitButton>

            {/* Forgot Password Link */}
            <Link
              href="/auth/forgot-password"
              className="no-underline hover:underline text-primary text-md text-right absolute right-0 mt-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
              data-testid="forgot-password-link"
              aria-label={t('forgotPassword')}
            >
              {t('forgotPassword')}
            </Link>
          </form>
        </FormProvider>
      </div>
    </section>
  );
}
