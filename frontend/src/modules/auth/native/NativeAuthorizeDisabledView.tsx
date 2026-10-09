'use client';

import { Heading } from '@/components/design-system';
import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ErrorCode } from '@app/core';

interface NativeAuthorizeDisabledViewProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
}

/** Native sign-in is turned off; shows the existing disabled message. */
export function NativeAuthorizeDisabledView({ headingRef }: NativeAuthorizeDisabledViewProps) {
  const t = useTranslations('auth.nativeAuthorize');
  const tCodes = useTranslations('errors.codes');

  return (
    <section className="mx-auto mt-12 max-w-sm" data-testid="native-authorize-disabled">
      <Heading level={1} variant="display" ref={headingRef} tabIndex={-1}>
        {t('disabledTitle')}
      </Heading>
      <Alert variant="warning" role="note" className="mt-4">
        <AlertDescription>{tCodes(ErrorCode.NATIVE_AUTH_DISABLED)}</AlertDescription>
      </Alert>
    </section>
  );
}
