import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ForgotPasswordPage } from '@/modules/auth/methods/password';

/**
 * Generate metadata for forgot password page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.forgotPassword' });

  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

/**
 * Forgot password route page
 * Accessible at /[locale]/auth/forgot-password
 */
export default function ForgotPasswordRoute() {
  return <ForgotPasswordPage />;
}
