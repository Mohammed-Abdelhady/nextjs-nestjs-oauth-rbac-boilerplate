import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ResetPasswordPage } from '@/modules/auth/methods/password';

/**
 * Generate metadata for reset password page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.resetPassword' });

  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

/**
 * Reset password route page
 * Accessible at /[locale]/auth/reset-password?email=xxx
 */
export default function ResetPasswordRoute() {
  return <ResetPasswordPage />;
}
