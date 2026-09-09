'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ErrorCode } from '@/constants/errorCodes';
import { useCompleteSignIn } from '@/modules/auth/hooks/useCompleteSignIn';
import { useFeatureDisabledHandler } from '@/modules/auth/hooks/useFeatureDisabled';
import { translatableErrorCode } from '@/modules/auth/utils/errorCodeMessage';
import { useVerifyMagicLinkMutation } from './magicLinkApi';

interface MagicLinkVerifyPanelProps {
  /** Token from the query string of the mailed link. */
  token: string;
  redirect: string | null;
}

/**
 * Spends a sign-in link.
 *
 * The token works once, so the request has to fire once. A ref guards it
 * against the double effect run of React strict mode, which would otherwise
 * burn the token on the first render and fail on the second.
 */
export function MagicLinkVerifyPanel({ token, redirect }: MagicLinkVerifyPanelProps) {
  const t = useTranslations('auth.magicLink.verify');
  const tCodes = useTranslations('errors.codes');
  const [verifyMagicLink] = useVerifyMagicLinkMutation();
  const completeSignIn = useCompleteSignIn();
  const handleFeatureDisabled = useFeatureDisabledHandler();
  const hasStarted = useRef(false);
  const [failureCode, setFailureCode] = useState<string | null>(
    token.length === 0 ? ErrorCode.MAGIC_LINK_INVALID : null,
  );

  useEffect(() => {
    if (token.length === 0 || hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    verifyMagicLink({ token })
      .unwrap()
      .then((response) => completeSignIn(response, redirect))
      .catch((error: unknown) => {
        handleFeatureDisabled(error, false);
        setFailureCode(translatableErrorCode(error, ErrorCode.MAGIC_LINK_INVALID));
      });
  }, [completeSignIn, handleFeatureDisabled, redirect, token, verifyMagicLink]);

  if (failureCode === null) {
    return (
      <section
        className="mt-12 flex flex-col items-center text-center"
        aria-live="polite"
        data-testid="magic-link-verify-pending"
      >
        <Loader2 className="h-8 w-8 motion-safe:animate-spin text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-extrabold">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('pending')}</p>
      </section>
    );
  }

  return (
    <section
      className="mt-12 flex flex-col items-center text-center"
      data-testid="magic-link-verify-error"
    >
      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-extrabold">{t('errorTitle')}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{tCodes(failureCode)}</p>

      <Button asChild className="mt-6 w-full max-w-xs" data-testid="magic-link-request-new">
        <Link href="/auth/login">{t('requestNew')}</Link>
      </Button>
      <Link
        href="/auth/login"
        className="mt-3 text-sm text-primary hover:underline"
        data-testid="magic-link-back-to-sign-in"
      >
        {t('backToSignIn')}
      </Link>
    </section>
  );
}
