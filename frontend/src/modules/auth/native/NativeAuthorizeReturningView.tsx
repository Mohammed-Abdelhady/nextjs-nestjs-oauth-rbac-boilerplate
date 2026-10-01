'use client';

import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NativeAuthorizeReturningViewProps {
  canReopen: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onReopen: () => void;
}

/** Shown after a reply while the browser hands the person back to the app. */
export function NativeAuthorizeReturningView({
  canReopen,
  headingRef,
  onReopen,
}: NativeAuthorizeReturningViewProps) {
  const t = useTranslations('auth.nativeAuthorize');

  return (
    <section
      className="mx-auto mt-12 max-w-sm text-center"
      data-testid="native-authorize-returning"
    >
      <Loader2
        className="mx-auto h-8 w-8 motion-safe:animate-spin text-primary"
        aria-hidden="true"
      />
      <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-2xl font-extrabold text-foreground">
        {t('returning')}
      </h1>
      {canReopen && (
        <Button
          type="button"
          size="lg"
          className="mt-6 w-full"
          onClick={onReopen}
          data-testid="native-authorize-reopen"
        >
          {t('reopen')}
        </Button>
      )}
    </section>
  );
}
