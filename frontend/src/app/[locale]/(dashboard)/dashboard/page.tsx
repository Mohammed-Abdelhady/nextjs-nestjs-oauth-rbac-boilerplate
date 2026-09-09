import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Generate metadata for user dashboard
 */
export async function generateMetadata({ params }: DashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.user' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

/**
 * User dashboard page
 * Accessible at /[locale]/dashboard
 * Protected by AuthGuard in layout
 */
export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.user' });

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-6" data-testid="user-dashboard">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('welcome')}</p>
        <div className="p-6 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">{t('featuresComingSoon')}</p>
        </div>
      </div>
    </div>
  );
}
