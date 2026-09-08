import { RoutePermissionGuard, USER_PERMISSIONS } from '@/modules/permissions';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface AdminDashboardPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Generate metadata for admin dashboard
 */
export async function generateMetadata({ params }: AdminDashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.admin' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

/**
 * Admin dashboard page
 * Accessible at /[locale]/admin/dashboard
 * Protected by RoutePermissionGuard - requires user management permissions
 */
export default async function AdminDashboardPage({ params }: AdminDashboardPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.admin' });

  return (
    <RoutePermissionGuard permission={USER_PERMISSIONS.LIST_ALL}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-6" data-testid="admin-dashboard">
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
