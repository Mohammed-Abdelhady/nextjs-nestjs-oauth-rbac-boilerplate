'use client';

import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface NativeAuthorizeErrorViewProps {
  message: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
}

/** Something failed; the mapped message and a retry. */
export function NativeAuthorizeErrorView({
  message,
  headingRef,
  onRetry,
}: NativeAuthorizeErrorViewProps) {
  const t = useTranslations('auth.nativeAuthorize');

  return (
    <section className="mx-auto mt-12 max-w-sm" data-testid="native-authorize-error">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold text-foreground">
        {t('errorTitle')}
      </h1>
      <Alert variant="destructive" role="alert" className="mt-4">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button
        type="button"
        size="lg"
        className="mt-6 w-full"
        onClick={onRetry}
        data-testid="native-authorize-retry"
      >
        {t('retry')}
      </Button>
    </section>
  );
}
