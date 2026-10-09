'use client';

import { Description, Heading } from '@/components/design-system';
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
      <Heading level={1} variant="display" ref={headingRef} tabIndex={-1} className="mt-4">
        {t('expiredTitle')}
      </Heading>
      <Description variant="lead" className="mt-2">
        {t('expiredBody')}
      </Description>
    </section>
  );
}
