'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QrCode } from '../QrCode';
import { copyText } from '../../utils/clipboard';
import type { TwoFactorSetup } from '../../types';

interface ScanStepProps {
  setup: TwoFactorSetup;
  onContinue: () => void;
}

/**
 * Step two. The QR code is drawn from the otpauth URL in the browser, so the
 * secret never travels to an image service. The same secret sits below it for
 * apps that take it typed.
 */
export function ScanStep({ setup, onContinue }: ScanStepProps) {
  const t = useTranslations('settings.twoFactor.setup.scan');
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    setCopied(await copyText(setup.secret));
  }, [setup.secret]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('body')}</p>

      <div className="flex justify-center rounded-lg bg-white p-3">
        <QrCode value={setup.otpauthUrl} label={t('qrLabel')} />
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t('secretLabel')}
        </p>
        <div className="flex items-center gap-2">
          <code
            className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm"
            data-testid="two-factor-secret"
          >
            {setup.secret}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onCopy}
            aria-label={t('copySecret')}
            data-testid="two-factor-copy-secret"
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      <Button
        type="button"
        className="w-full"
        onClick={onContinue}
        data-testid="two-factor-scan-continue"
      >
        {t('continue')}
        <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </Button>
    </div>
  );
}
