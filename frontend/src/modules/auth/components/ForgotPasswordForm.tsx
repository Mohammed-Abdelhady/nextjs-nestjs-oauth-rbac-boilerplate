'use client';

import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { FormProvider } from 'react-hook-form';
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import { FormInput } from '@/components/forms';
import { useForgotPasswordMutation } from '../store/authApi';
import { zodEmail } from '@/lib/validations';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallback, useMemo } from 'react';
import { toast } from '@/lib/toast';
import { Link, useRouter } from '@/i18n/navigation';

/**
 * Forgot password form validation schema
 */
const createForgotPasswordSchema = (t: (key: string) => string) =>
  z.object({
    email: zodEmail({
      required: true,
      messages: {
        required: t('errors.emailRequired'),
        invalid: t('errors.emailInvalid'),
      },
    }),
  });

type ForgotPasswordFormData = z.infer<ReturnType<typeof createForgotPasswordSchema>>;

/**
 * ForgotPasswordForm component for requesting password reset
 * Sends reset link to user's email address
 *
 * @example
 * <ForgotPasswordForm />
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const tToast = useTranslations('toast');
  const router = useRouter();
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  // Memoize schema creation when translation function changes
  const forgotPasswordSchema = useMemo(() => createForgotPasswordSchema(t), [t]);

  // Initialize form with validation
  const form = useFormWithValidation({
    schema: forgotPasswordSchema,
    mode: 'onBlur',
    defaultValues: {
      email: '',
    },
  });

  const {
    handleSubmit,
    formState: { errors },
    setError,
  } = form;

  // Memoize submit handler to prevent recreating on every render
  const onSubmit = useCallback(
    async (data: ForgotPasswordFormData) => {
      try {
        await forgotPassword({
          email: data.email,
        }).unwrap();

        // Show success toast
        toast.success(tToast('success.resetLinkSent'));

        // Redirect to reset password page with email
        router.push(`/auth/reset-password?email=${encodeURIComponent(data.email)}`);
      } catch (err: unknown) {
        // Handle API errors
        const error = err as { data?: { error?: { code?: string; message?: string } } };
        let errorMessage = t('errors.serverError');

        const errorCode = error.data?.error?.code;
        const errorMsg = error.data?.error?.message;

        if (errorCode === 'NETWORK_ERROR') {
          errorMessage = t('errors.networkError');
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
    [forgotPassword, router, setError, t, tToast],
  );

  return (
    <section className="mt-12 flex flex-col items-center" aria-labelledby="forgot-password-heading">
      {/* Title */}
      <h1
        id="forgot-password-heading"
        className="text-2xl xl:text-3xl font-extrabold text-foreground"
        data-testid="forgot-password-title"
      >
        {t('title')}
      </h1>

      {/* Subtitle */}
      <p className="text-base text-muted-foreground mt-4 text-center max-w-md">{t('subtitle')}</p>

      <div className="w-full flex-1 mt-8">
        {/* Forgot Password Form */}
        <FormProvider {...form}>
          <form
            className="mx-auto max-w-xs"
            onSubmit={handleSubmit(onSubmit)}
            data-testid="forgot-password-form"
            noValidate
            aria-labelledby="forgot-password-heading"
            aria-describedby={errors.root?.message ? 'forgot-password-error' : undefined}
          >
            {/* Global Error Alert - Live Region */}
            {errors.root?.message && (
              <div
                id="forgot-password-error"
                className="mb-4 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                data-testid="forgot-password-error"
              >
                {errors.root.message}
              </div>
            )}

            {/* Email Input */}
            <FormInput
              name="email"
              type="email"
              placeholder={t('email')}
              autoComplete="email"
              disabled={isLoading}
              autoFocus
              aria-label={t('email')}
              aria-required="true"
            />

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="h-14 mt-5 tracking-wide font-semibold w-full py-4 rounded-lg transition-all duration-300 ease-in-out flex items-center justify-center"
              data-testid="forgot-password-submit"
              aria-label={isLoading ? `${t('submit')}...` : t('submit')}
              aria-busy={isLoading}
            >
              <Mail className="w-6 h-6 -ms-2" aria-hidden="true" />
              <span className="ms-3">{isLoading ? `${t('submit')}...` : t('submit')}</span>
            </Button>

            {/* Back to Login Link */}
            <div className="mt-6 text-center">
              <Link
                href="/auth/login"
                className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                data-testid="back-to-login-link"
              >
                {t('backToLogin')}
              </Link>
            </div>
          </form>
        </FormProvider>
      </div>
    </section>
  );
}
