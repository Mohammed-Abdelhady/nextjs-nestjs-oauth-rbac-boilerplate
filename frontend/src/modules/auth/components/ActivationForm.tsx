'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider } from 'react-hook-form';
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import { FormInput } from '@/components/forms';
import { useActivateMutation, useResendActivationMutation } from '../store/authApi';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { useAppDispatch } from '@/store/hooks';
import { setUser } from '@/modules/auth/store/authSlice';
import { useRouter } from '@/i18n/navigation';
import { WelcomeModal } from './WelcomeModal';
import { createActivationSchema, type ActivationFormData } from '../utils/activationSchema';

/**
 * ActivationForm component for email verification
 * Auto-fills email from URL parameters and handles 6-digit code input
 *
 * @example
 * <ActivationForm />
 */
export function ActivationForm() {
  const t = useTranslations('auth.activate');
  const tToast = useTranslations('toast');
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const [activate, { isLoading }] = useActivateMutation();
  const [resendActivation, { isLoading: isResending }] = useResendActivationMutation();
  const [showWelcome, setShowWelcome] = useState(false);
  const [userName, setUserName] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Get email from URL params
  const emailFromUrl = searchParams.get('email') || '';

  // Memoize schema creation when translation function changes
  const activationSchema = useMemo(() => createActivationSchema(t), [t]);

  // Initialize form with validation and default email value
  const form = useFormWithValidation({
    schema: activationSchema,
    mode: 'onBlur',
    defaultValues: {
      email: emailFromUrl,
      code: '',
    },
  });

  const {
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
  } = form;

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Redirect to register if no email in URL
  useEffect(() => {
    if (!emailFromUrl) {
      router.push('/auth/register');
    } else {
      setValue('email', emailFromUrl);
    }
  }, [emailFromUrl, router, setValue]);

  // Memoize submit handler to prevent recreating on every render
  const onSubmit = useCallback(
    async (data: ActivationFormData) => {
      try {
        const result = await activate({
          email: data.email,
          code: data.code,
        }).unwrap();

        // Successful activation - session cookie set by backend
        dispatch(setUser(result.user));

        toast.success(tToast('success.activationSuccess'));

        // Show welcome modal with user name
        setUserName(result.user.name);
        setShowWelcome(true);
      } catch (err: unknown) {
        // Handle API errors
        const error = err as { data?: { error?: { code?: string; message?: string } } };
        let errorMessage = t('errors.serverError');

        const errorCode = error.data?.error?.code;
        const errorMsg = error.data?.error?.message;

        if (errorCode === 'ACTIVATION_CODE_INVALID' || errorMsg?.includes('Invalid')) {
          errorMessage = t('errors.codeInvalid');
        } else if (errorCode === 'ACTIVATION_CODE_EXPIRED' || errorMsg?.includes('expired')) {
          errorMessage = t('errors.codeExpired');
          // Redirect to register after short delay
          setTimeout(() => router.push('/auth/register'), 2000);
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
    [activate, dispatch, router, setError, setValue, t, tToast],
  );

  // Handle resend activation code
  const handleResend = useCallback(async () => {
    try {
      await resendActivation({ email: emailFromUrl }).unwrap();
      toast.success(tToast('success.resendSuccess'));
      // Start 60-second cooldown
      setCooldownSeconds(60);
    } catch (err: unknown) {
      const error = err as { data?: { error?: { code?: string; message?: string } } };
      let errorMessage = tToast('error.resendError');

      const errorCode = error.data?.error?.code;
      const errorMsg = error.data?.error?.message;

      if (errorCode === 'NO_PENDING_REGISTRATION_FOR_RESEND') {
        errorMessage = tToast('error.resendNoPending');
        // Redirect to register after short delay
        setTimeout(() => router.push('/auth/register'), 3000);
      } else if (errorCode === 'RATE_LIMIT_EXCEEDED') {
        errorMessage = tToast('error.resendRateLimit');
      } else if (errorMsg) {
        errorMessage = errorMsg;
      }

      toast.error(errorMessage);
    }
  }, [resendActivation, emailFromUrl, router, tToast]);

  // Handle code input to only allow numeric characters
  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
      setValue('code', value);
    },
    [setValue],
  );

  const isDisabled = isLoading || isResending || cooldownSeconds > 0;

  return (
    <section className="mt-12 flex flex-col items-center" aria-labelledby="activate-heading">
      {/* Title */}
      <h1
        id="activate-heading"
        className="text-2xl xl:text-3xl font-extrabold text-foreground"
        data-testid="activate-title"
      >
        {t('title')}
      </h1>

      {/* Description */}
      <p className="text-base text-muted-foreground mt-4 text-center max-w-md">
        {t('description')}
      </p>

      <div className="w-full flex-1 mt-8">
        {/* Activation Form */}
        <FormProvider {...form}>
          <form
            className="mx-auto max-w-xs"
            onSubmit={handleSubmit(onSubmit)}
            data-testid="activate-form"
            noValidate
            aria-labelledby="activate-heading"
            aria-describedby={errors.root?.message ? 'activate-error' : undefined}
          >
            {/* Global Error Alert - Live Region */}
            {errors.root?.message && (
              <div
                id="activate-error"
                className="mb-4 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                data-testid="activate-error"
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

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isDisabled}
              className="h-14 mt-5 tracking-wide font-semibold w-full py-4 rounded-lg transition-all duration-300 ease-in-out flex items-center justify-center"
              data-testid="activate-submit"
              aria-label={isLoading ? `${t('submit')}...` : t('submit')}
              aria-busy={isLoading}
            >
              <ShieldCheck className="w-6 h-6 -ms-2" aria-hidden="true" />
              <span className="ms-3">{isLoading ? `${t('submit')}...` : t('submit')}</span>
            </Button>

            {/* Resend Code Button */}
            <Button
              type="button"
              onClick={handleResend}
              disabled={isDisabled}
              variant="ghost"
              className="mt-4 w-full flex items-center justify-center gap-2"
              data-testid="resend-button"
              aria-label={
                isResending
                  ? t('resendSending')
                  : cooldownSeconds > 0
                    ? t('resendCooldown', { seconds: cooldownSeconds })
                    : t('resendButton')
              }
              aria-busy={isResending || cooldownSeconds > 0}
            >
              <RefreshCw
                className={`w-4 h-4 ${isResending || cooldownSeconds > 0 ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>
                {isResending
                  ? t('resendSending')
                  : cooldownSeconds > 0
                    ? t('resendCooldown', { seconds: cooldownSeconds })
                    : t('resendButton')}
              </span>
            </Button>
          </form>
        </FormProvider>
      </div>

      {/* Welcome Modal */}
      <WelcomeModal
        isOpen={showWelcome}
        userName={userName}
        onClose={() => setShowWelcome(false)}
      />
    </section>
  );
}
