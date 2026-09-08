'use client';

import { useTranslations } from 'next-intl';
import { FormInput } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { CodeField } from './CodeField';
import type { AnswerFormData } from '../utils/answerSchema';

interface TwoFactorAnswerFieldsProps {
  useRecoveryCode: boolean;
  onToggle: () => void;
  isBusy: boolean;
}

/**
 * The code box with a way to switch to a recovery code, shared by the sign-in
 * challenge and the disable dialog.
 */
export function TwoFactorAnswerFields({
  useRecoveryCode,
  onToggle,
  isBusy,
}: TwoFactorAnswerFieldsProps) {
  const t = useTranslations('auth.twoFactor');

  return (
    <>
      {useRecoveryCode ? (
        <FormInput<AnswerFormData>
          name="recoveryCode"
          label={t('recoveryCode')}
          placeholder="K3M7QRTVWX"
          autoComplete="one-time-code"
          disabled={isBusy}
          autoFocus
          className="text-center text-lg uppercase tracking-widest"
          data-testid="two-factor-recovery-code-input"
        />
      ) : (
        <CodeField<AnswerFormData>
          name="code"
          label={t('code')}
          disabled={isBusy}
          autoFocus
          testId="two-factor-code-input"
        />
      )}

      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-sm"
        onClick={onToggle}
        data-testid="two-factor-toggle-recovery"
      >
        {useRecoveryCode ? t('useCode') : t('useRecoveryCode')}
      </Button>
    </>
  );
}
