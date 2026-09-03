'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { FormProvider } from 'react-hook-form';
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import { FormInput, FormPassword } from '@/components/forms';
import { useResetPasswordMutation } from '../store/authApi';
import { zodPassword } from '@/lib/validations';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallback, useMemo, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { Link, useRouter } from '@/i18n/navigation';

/**
 * Reset password form validation schema
 */
const createResetPasswordSchema = (t: (key: string) => string) =>
  z
    .object({
      email: z
        .string({ required_error: t('errors.emailRequired') })
        .trim()
        .min(1, t('errors.emailRequired'))
        .email(t('errors.emailInvalid')),
      code: z
        .string({ required_error: t('errors.codeRequired') })
        .trim()
        .length(6, t('errors.codeLength'))
        .regex(/^\d{6}$/, t('errors.codeInvalid')),
      password: zodPassword({
        required: true,
        min: 8,
        messages: {
          required: t('errors.passwordRequired'),
          min: t('errors.passwordMinLength'),
        },
      }),
      confirmPassword: z
        .string({ required_error: t('errors.confirmRequired') })
        .trim()
        .min(1, t('errors.confirmRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('errors.passwordMismatch'),
      path: ['confirmPassword'],
    });

type ResetPasswordFormData = z.infer<ReturnType<typeof createResetPasswordSchema>>;

/**
 * ResetPasswordForm component for completing password reset
 * Uses 6-digit code sent via email (similar to activation flow)
 *
 * @example
 * <ResetPasswordForm />
 */
export function ResetPasswordForm() {
  const t = useTranslations('auth.resetPassword');
  const tToast = useTranslations('toast');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  // Get email from URL params (passed from forgot password page)
  const emailFromUrl = searchParams.get('email') || '';

  // Memoize schema creation when translation function changes
  const resetPasswordSchema = useMemo(() => createResetPasswordSchema(t), [t]);

  // Initialize form with validation
  const form = useFormWithValidation({
    schema: resetPasswordSchema,
    mode: 'onBlur',
    defaultValues: {
      email: emailFromUrl,
      code: '',
      password: '',
      confirmPassword: '',
    },
  });

  const {
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
  } = form;

  // Redirect to forgot password if no email in URL
  useEffect(() => {
    if (!emailFromUrl) {
      router.push('/auth/forgot-password');
    } else {
      setValue('email', emailFromUrl);
    }
  }, [emailFromUrl, router, setValue]);

  // Memoize submit handler to prevent recreating on every render
  const onSubmit = useCallback(
    async (data: ResetPasswordFormData) => {
      try {
        await resetPassword({
          email: data.email,
          code: data.code,
          newPassword: data.password,
        }).unwrap();

        // Show success message
        toast.success(tToast('success.passwordReset'));

        // Redirect to login after short delay
        setTimeout(() => {
          router.push('/auth/login');
        }, 1500);
      } catch (err: unknown) {
        // Handle API errors
        const error = err as { data?: { error?: { code?: string; message?: string } } };
        let errorMessage = t('errors.serverError');

        const errorCode = error.data?.error?.code;
        const errorMsg = error.data?.error?.message;

        if (errorCode === 'RESET_CODE_INVALID' || errorMsg?.includes('Invalid')) {
          errorMessage = t('errors.codeInvalid');
        } else if (errorCode === 'RESET_CODE_EXPIRED' || errorMsg?.includes('expired')) {
          errorMessage = t('errors.codeExpired');
        } else if (errorCode === 'NETWORK_ERROR') {
          errorMessage = t('errors.networkError');
        } else if (errorMsg) {
          errorMessage = errorMsg;
        }

        setError('root', {
          type: 'manual',
          message: errorMessage,
        });
        toast.error(errorMessage);

        // Clear code field for retry
        setValue('code', '');
      }
    },
    [resetPassword, router, setError, setValue, t, tToast],
  );

  // Handle code input to only allow numeric characters
  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
      setValue('code', value);
    },
    [setValue],
  );

  return (
    <section className="mt-12 flex flex-col items-center" aria-labelledby="reset-password-heading">
      {/* Title */}
      <h1
        id="reset-password-heading"
        className="text-2xl xl:text-3xl font-extrabold text-foreground"
        data-testid="reset-password-title"
      >
        {t('title')}
      </h1>

      {/* Subtitle */}
      <p className="text-base text-muted-foreground mt-4 text-center max-w-md">{t('subtitle')}</p>

      <div className="w-full flex-1 mt-8">
        <FormProvider {...form}>
          <form
            className="mx-auto max-w-xs"
            onSubmit={handleSubmit(onSubmit)}
            data-testid="reset-password-form"
            noValidate
            aria-labelledby="reset-password-heading"
            aria-describedby={errors.root?.message ? 'reset-password-error' : undefined}
          >
            {/* Global Error Alert - Live Region */}
            {errors.root?.message && (
              <div
                id="reset-password-error"
                className="mb-4 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                data-testid="reset-password-error"
              >
                {errors.root.message}
              </div>
            )}

            {/* Email Input (readonly, pre-filled) */}
            <FormInput
              name="email"
              type="email"
              placeholder={t('email')}
              autoComplete="email"
              disabled={isLoading}
              readOnly
              className="bg-muted"
              aria-label={t('email')}
              aria-required="true"
              aria-readonly="true"
            />

            {/* Code Input */}
            <FormInput
              name="code"
              type="text"
              inputMode="numeric"
              placeholder={t('code')}
              autoComplete="one-time-code"
              disabled={isLoading}
              maxLength={6}
              className="mt-5 text-center text-2xl tracking-widest"
              autoFocus
              onChange={handleCodeChange}
              aria-label={t('code')}
              aria-required="true"
              aria-invalid={!!errors.code}
              aria-describedby={errors.code ? 'code-error' : undefined}
            />

            {/* New Password Input */}
            <FormPassword
              name="password"
              placeholder={t('password')}
              autoComplete="new-password"
              disabled={isLoading}
              className="mt-5"
              aria-label={t('password')}
              aria-required="true"
            />

            {/* Confirm Password Input */}
            <FormPassword
              name="confirmPassword"
              placeholder={t('confirmPassword')}
              autoComplete="new-password"
              disabled={isLoading}
              className="mt-5"
              aria-label={t('confirmPassword')}
              aria-required="true"
            />

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="h-14 mt-5 tracking-wide font-semibold w-full py-4 rounded-lg transition-all duration-300 ease-in-out flex items-center justify-center"
              data-testid="reset-password-submit"
              aria-label={isLoading ? `${t('submit')}...` : t('submit')}
              aria-busy={isLoading}
            >
              <KeyRound className="w-6 h-6 -ms-2" aria-hidden="true" />
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
