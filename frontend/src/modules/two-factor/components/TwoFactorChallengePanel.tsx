'use client';

import { useCallback, useMemo, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { useFormWithValidation } from '@/hooks/useFormWithValidation';
import { FormRootError, SubmitButton } from '@/components/forms';
import { Link } from '@/i18n/navigation';
import { useCompleteSignIn } from '@/modules/auth/hooks/useCompleteSignIn';
import { useFeatureDisabledHandler } from '@/modules/auth/hooks/useFeatureDisabled';
import { translatableErrorCode } from '@/modules/auth/utils/errorCodeMessage';
import { useVerifyTwoFactorMutation } from '../api';
import { createAnswerSchema, toAnswer, type AnswerFormData } from '../utils/answerSchema';
import { TwoFactorAnswerFields } from './TwoFactorAnswerFields';

interface TwoFactorChallengePanelProps {
  redirect: string | null;
}

/**
 * The second half of a sign-in that was held for a code.
 *
 * The challenge cookie is already set, so this only collects the answer and
 * finishes the sign-in the same way the password form does.
 */
export function TwoFactorChallengePanel({ redirect }: TwoFactorChallengePanelProps) {
  const t = useTranslations('auth.twoFactor');
  const tCodes = useTranslations('errors.codes');
  const [verify, { isLoading }] = useVerifyTwoFactorMutation();
  const completeSignIn = useCompleteSignIn();
  const handleFeatureDisabled = useFeatureDisabledHandler();
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const schema = useMemo(() => createAnswerSchema(t), [t]);
  const form = useFormWithValidation({
    schema,
    defaultValues: { code: '', recoveryCode: '' },
    mode: 'onSubmit',
  });

  const {
    handleSubmit,
    formState: { errors },
    setError,
    resetField,
  } = form;

  const onToggle = useCallback(() => {
    resetField('code');
    resetField('recoveryCode');
    setUseRecoveryCode((current) => !current);
  }, [resetField]);

  const onSubmit = useCallback(
    async (data: AnswerFormData) => {
      try {
        const response = await verify(toAnswer(data)).unwrap();
        await completeSignIn(response, redirect);
      } catch (err) {
        handleFeatureDisabled(err, false);
        setError('root', { type: 'manual', message: tCodes(translatableErrorCode(err)) });
      }
    },
    [completeSignIn, handleFeatureDisabled, redirect, setError, tCodes, verify],
  );

  return (
    <section className="mt-12 flex flex-col items-center" aria-labelledby="two-factor-heading">
      <h1
        id="two-factor-heading"
        className="text-2xl xl:text-3xl font-extrabold text-foreground"
        data-testid="two-factor-title"
      >
        {t('title')}
      </h1>
      <p className="mt-4 max-w-sm text-center text-sm text-muted-foreground">{t('description')}</p>

      <FormProvider {...form}>
        <form
          className="mt-8 w-full max-w-xs"
          onSubmit={handleSubmit(onSubmit)}
          data-testid="two-factor-form"
          noValidate
          aria-labelledby="two-factor-heading"
        >
          <FormRootError
            id="two-factor-error"
            error={errors.root?.message}
            testId="two-factor-error"
          />

          <TwoFactorAnswerFields
            useRecoveryCode={useRecoveryCode}
            onToggle={onToggle}
            isBusy={isLoading}
          />

          <SubmitButton isLoading={isLoading} icon={ShieldCheck} testId="two-factor-submit">
            {t('submit')}
          </SubmitButton>
        </form>
      </FormProvider>

      <Link
        href="/auth/login"
        className="mt-6 text-sm text-primary hover:underline"
        data-testid="two-factor-back-to-sign-in"
      >
        {t('backToSignIn')}
      </Link>
    </section>
  );
}
