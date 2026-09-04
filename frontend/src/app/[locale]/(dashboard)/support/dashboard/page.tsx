import { RoutePermissionGuard, SESSION_PERMISSIONS } from '@/modules/permissions';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface SupportDashboardPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Generate metadata for support dashboard
 */
export async function generateMetadata({ params }: SupportDashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.support' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

/**
 * Support dashboard page
 * Accessible at /[locale]/support/dashboard
 * Protected by RoutePermissionGuard - requires session management permissions
 */
export default async function SupportDashboardPage({ params }: SupportDashboardPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.support' });

  return (
    <RoutePermissionGuard permission={SESSION_PERMISSIONS.READ_ALL}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-6" data-testid="support-dashboard">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
          <p className="text-lg text-muted-foreground">{t('welcome')}</p>
          <div className="p-6 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">{t('featuresComingSoon')}</p>
          </div>
        </div>
      </div>
    </RoutePermissionGuard>
  );
}
