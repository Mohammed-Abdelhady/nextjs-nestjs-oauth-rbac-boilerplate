'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ServerCrash, RefreshCw, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorPageLayout } from '@/components/layout/ErrorPageLayout';
import { toast } from '@/lib/toast';

/**
 * 500 Server Error Page
 *
 * Next.js error boundary for unhandled runtime errors.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.500');
  const tCommon = useTranslations('errors');

  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <ErrorPageLayout
      code="500"
      title={t('title')}
      description={t('description')}
      subtitle={t('subtitle')}
      icon={ServerCrash}
      variant="destructive"
      errorDigest={error.digest}
      errorIdLabel={t('errorId')}
      actions={
        <>
          <Button onClick={() => reset()} className="w-full sm:w-auto">
            <RefreshCw className="w-5 h-5 me-2" />
            {t('reload')}
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.info(tCommon('comingSoon'))}
            className="w-full sm:w-auto"
          >
            <Mail className="w-5 h-5 me-2" />
            {t('reportIssue')}
          </Button>
        </>
      }
    />
  );
}
