'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider } from 'react-hook-form';
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import { FormInput, FormRootError, SubmitButton } from '@/components/forms';
import { useActivateMutation, useResendActivationMutation } from '../store/authApi';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { useAppDispatch } from '@/store/hooks';
import { setUser } from '@/modules/auth/store/authSlice';
import { useRouter } from '@/i18n/navigation';
import { parseApiError } from '@/lib/apiError';
import { filterDigits } from '../utils/digitFilter';
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
        const parsed = parseApiError(err);
        let errorMessage = t('errors.serverError');

        if (parsed.code === 'ACTIVATION_CODE_INVALID' || parsed.message?.includes('Invalid')) {
          errorMessage = t('errors.codeInvalid');
        } else if (
          parsed.code === 'ACTIVATION_CODE_EXPIRED' ||
          parsed.message?.includes('expired')
        ) {
          errorMessage = t('errors.codeExpired');
          setTimeout(() => router.push('/auth/register'), 2000);
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
    [activate, dispatch, router, setError, setValue, t, tToast],
  );

  // Handle resend activation code
  const handleResend = useCallback(async () => {
    try {
      await resendActivation({ email: emailFromUrl }).unwrap();
      toast.success(tToast('success.resendSuccess'));
      setCooldownSeconds(60);
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      let errorMessage = tToast('error.resendError');

      if (parsed.code === 'NO_PENDING_REGISTRATION_FOR_RESEND') {
        errorMessage = tToast('error.resendNoPending');
        setTimeout(() => router.push('/auth/register'), 3000);
      } else if (parsed.code === 'RATE_LIMIT_EXCEEDED') {
        errorMessage = tToast('error.resendRateLimit');
      } else if (parsed.message) {
        errorMessage = parsed.message;
      }

      toast.error(errorMessage);
    }
  }, [resendActivation, emailFromUrl, router, tToast]);

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = filterDigits(e.target.value, 6);
  }, []);

  const isResendDisabled = isResending || cooldownSeconds > 0;

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
            <FormRootError
              id="activate-error"
              error={errors.root?.message}
              testId="activate-error"
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

            {/* Submit Button */}
            <SubmitButton isLoading={isLoading} icon={ShieldCheck} testId="activate-submit">
              {t('submit')}
            </SubmitButton>

            {/* Resend Code Button */}
            <Button
              type="button"
              onClick={handleResend}
              disabled={isResendDisabled}
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
        onClose={() => {
          setShowWelcome(false);
          router.push('/dashboard');
        }}
      />
    </section>
  );
}
