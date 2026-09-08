'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { SearchX, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorPageLayout } from '@/components/layout/ErrorPageLayout';

/**
 * 404 Not Found Error Page
 *
 * Automatically triggered by Next.js for non-existent routes
 * via the catch-all [...slug] route calling notFound().
 */
export default function NotFound() {
  const router = useRouter();
  const t = useTranslations('errors.404');

  return (
    <ErrorPageLayout
      code="404"
      title={t('title')}
      description={t('description')}
      subtitle={t('subtitle')}
      icon={SearchX}
      variant="primary"
      actions={
        <>
          <Button asChild className="w-full sm:w-auto" data-testid="not-found-home-button">
            <Link href="/">
              <Home className="w-5 h-5 me-2" />
              {t('goHome')}
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="w-full sm:w-auto"
            data-testid="not-found-back-button"
          >
            <ArrowLeft className="w-5 h-5 me-2 rtl:rotate-180" />
            {t('goBack')}
          </Button>
        </>
      }
    />
  );
}
