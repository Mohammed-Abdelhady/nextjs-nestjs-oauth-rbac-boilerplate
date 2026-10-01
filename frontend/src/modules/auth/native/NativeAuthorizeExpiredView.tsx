'use client';

import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';

interface NativeAuthorizeExpiredViewProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
}

/** The transaction is gone; there is nothing left to approve or deny. */
export function NativeAuthorizeExpiredView({ headingRef }: NativeAuthorizeExpiredViewProps) {
  const t = useTranslations('auth.nativeAuthorize');

  return (
    <section className="mx-auto mt-12 max-w-sm text-center" data-testid="native-authorize-expired">
      <AlertCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
      <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-2xl font-extrabold text-foreground">
        {t('expiredTitle')}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('expiredBody')}</p>
    </section>
  );
}
