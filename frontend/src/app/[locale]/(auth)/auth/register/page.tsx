import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RegisterPage } from '@/modules/auth/methods/password';

/**
 * Generate metadata for registration page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.register' });

  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

/**
 * Registration route page
 * Accessible at /[locale]/auth/register
 */
export default function RegisterRoute() {
  return <RegisterPage />;
}
