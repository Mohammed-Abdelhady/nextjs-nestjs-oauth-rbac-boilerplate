'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { FormProvider } from 'react-hook-form';
import { MailCheck, Send } from 'lucide-react';
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import { FormInput, FormRootError, SubmitButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { zodEmail } from '@/lib/validations';
import { parseApiError } from '@/lib/apiError';
import { useCooldown } from '@/modules/auth/hooks/useCooldown';
import { useFeatureDisabledHandler } from '@/modules/auth/hooks/useFeatureDisabled';
import type { AuthMethodFormProps } from '../types';
import { useRequestMagicLinkMutation } from './magicLinkApi';

/** Seconds before the same address may ask for another link. */
const RESEND_COOLDOWN_SECONDS = 60;

const createMagicLinkSchema = (t: (key: string) => string) =>
  z.object({
    email: zodEmail({
      required: true,
      messages: { required: t('errors.emailRequired'), invalid: t('errors.emailInvalid') },
    }),
  });

type MagicLinkFormData = z.infer<ReturnType<typeof createMagicLinkSchema>>;

/**
 * Asks for a one-time sign-in link.
 *
 * The confirmation says a link is on its way whatever the backend did, which
 * matches a reply that is deliberately the same for every address.
 */
export function MagicLinkRequestForm({ isOnlyMethod }: AuthMethodFormProps) {
  const t = useTranslations('auth.magicLink');
  const [requestMagicLink, { isLoading }] = useRequestMagicLinkMutation();
  const handleFeatureDisabled = useFeatureDisabledHandler();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { secondsLeft, isCooling, start: startCooldown } = useCooldown(RESEND_COOLDOWN_SECONDS);

  const schema = useMemo(() => createMagicLinkSchema(t), [t]);
  const form = useFormWithValidation({
    schema,
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  const {
    handleSubmit,
    formState: { errors },
    setError,
    getValues,
  } = form;

  const send = useCallback(
    async (email: string) => {
      try {
        await requestMagicLink({ email }).unwrap();
        setSentTo(email);
        startCooldown();
      } catch (err) {
        // The gate takes this form off the page once the refetch lands.
        if (handleFeatureDisabled(err)) {
          return;
        }
        setError('root', { type: 'manual', message: parseApiError(err).message || t('error') });
      }
    },
    [handleFeatureDisabled, requestMagicLink, setError, startCooldown, t],
  );

  const onSubmit = useCallback(async (data: MagicLinkFormData) => send(data.email), [send]);

  const onResend = useCallback(() => send(getValues('email')), [getValues, send]);

  if (sentTo !== null) {
    return (
      <div className="mx-auto max-w-xs text-center" role="status" data-testid="magic-link-sent">
        <MailCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
        <h3 className="mt-3 text-lg font-semibold">{t('sentTitle')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t('sentBody', { email: sentTo })}</p>
        <Button
          type="button"
          variant="ghost"
          className="mt-4 w-full"
          onClick={onResend}
          disabled={isLoading || isCooling}
          data-testid="magic-link-resend"
        >
          {isCooling ? t('resendCooldown', { seconds: secondsLeft }) : t('resend')}
        </Button>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form
        className="mx-auto max-w-xs"
        onSubmit={handleSubmit(onSubmit)}
        data-testid="magic-link-form"
        noValidate
        aria-label={t('title')}
      >
        {!isOnlyMethod && (
          <p className="mb-3 text-center text-sm text-muted-foreground">{t('description')}</p>
        )}

        <FormRootError
          id="magic-link-error"
          error={errors.root?.message}
          testId="magic-link-error"
        />

        <FormInput
          name="email"
          type="email"
          label={t('email')}
          placeholder="name@example.com"
          autoComplete="email"
          disabled={isLoading}
          autoFocus={isOnlyMethod}
          data-testid="magic-link-email-input"
        />

        <SubmitButton isLoading={isLoading} icon={Send} testId="magic-link-submit">
          {t('submit')}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
