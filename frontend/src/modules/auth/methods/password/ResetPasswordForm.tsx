'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { useResetPasswordMutation } from '@/modules/auth/store/authApi';
import { zodPassword } from '@/lib/validations';
import { KeyRound } from 'lucide-react';
import { useCallback, useMemo, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { Link, useRouter } from '@/i18n/navigation';
import { parseApiError } from '@/lib/apiError';
import { filterDigits } from '@/modules/auth/utils/digitFilter';

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
          uppercase: t('errors.passwordUppercase'),
          lowercase: t('errors.passwordLowercase'),
          number: t('errors.passwordNumber'),
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
        const parsed = parseApiError(err);
        let errorMessage = t('errors.serverError');

        if (parsed.code === 'RESET_CODE_INVALID' || parsed.message?.includes('Invalid')) {
          errorMessage = t('errors.codeInvalid');
        } else if (parsed.code === 'RESET_CODE_EXPIRED' || parsed.message?.includes('expired')) {
          errorMessage = t('errors.codeExpired');
        } else if (parsed.code === 'NETWORK_ERROR') {
          errorMessage = t('errors.networkError');
        } else if (parsed.message) {
          errorMessage = parsed.message;
        }

        setError('root', {
          type: 'manual',
          message: errorMessage,
        });
        toast.error(errorMessage);

        setValue('code', '');
      }
    },
    [resetPassword, router, setError, setValue, t, tToast],
  );

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = filterDigits(e.target.value, 6);
  }, []);

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
            <FormRootError
              id="reset-password-error"
              error={errors.root?.message}
              testId="reset-password-error"
            />

            {/* Email Input (readonly, pre-filled) */}
            <FormInput
              name="email"
              type="email"
              label={t('email')}
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isLoading}
              readOnly
              className="bg-muted"
            />

            {/* Code Input */}
            <FormInput
              name="code"
              type="text"
              inputMode="numeric"
              label={t('code')}
              placeholder="123456"
              autoComplete="one-time-code"
              disabled={isLoading}
              maxLength={6}
              className="mt-5 text-center text-2xl tracking-widest"
              autoFocus
              onChange={handleCodeChange}
            />

            {/* New Password Input */}
            <FormPassword
              name="password"
              label={t('password')}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isLoading}
              className="mt-5"
            />

            <PasswordRules name="password" className="mt-3" />

            {/* Confirm Password Input */}
            <FormPassword
              name="confirmPassword"
              label={t('confirmPassword')}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isLoading}
              className="mt-5"
            />

            {/* Submit Button */}
            <SubmitButton isLoading={isLoading} icon={KeyRound} testId="reset-password-submit">
              {t('submit')}
            </SubmitButton>

            {/* Back to Login Link */}
            <div className="mt-6 text-center">
              <Link
                href="/auth/login"
                className="text-sm font-semibold text-primary hover:underline transition-colors"
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
