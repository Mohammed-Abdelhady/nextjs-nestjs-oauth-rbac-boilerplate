'use client';

import { useCallback, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RecoveryCodeList } from '../RecoveryCodeList';

interface RecoveryCodesStepProps {
  codes: readonly string[];
  onDone: () => void;
}

/**
 * Step four. Only hashes of these codes are kept, so this screen is the one
 * chance to save them. The button stays shut until the person says they did.
 */
export function RecoveryCodesStep({ codes, onDone }: RecoveryCodesStepProps) {
  const t = useTranslations('settings.twoFactor.setup.recoveryCodes');
  const [acknowledged, setAcknowledged] = useState(false);
  const checkboxId = useId();

  const onCheckedChange = useCallback(
    (checked: boolean | 'indeterminate') => setAcknowledged(checked === true),
    [],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('body')}</p>

      <RecoveryCodeList codes={codes} />

      <div className="flex items-start gap-2">
        <Checkbox
          id={checkboxId}
          checked={acknowledged}
          onCheckedChange={onCheckedChange}
          data-testid="two-factor-saved-codes"
        />
        <Label htmlFor={checkboxId} className="text-sm font-normal leading-snug">
          {t('acknowledge')}
        </Label>
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={!acknowledged}
        onClick={onDone}
        data-testid="two-factor-setup-done"
      >
        {t('done')}
      </Button>
    </div>
  );
}
