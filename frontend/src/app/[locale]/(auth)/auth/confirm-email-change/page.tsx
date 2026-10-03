import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { ConfirmEmailChangeForm } from '@/modules/auth/components/ConfirmEmailChangeForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.confirmEmailChange' });
  return { title: t('title'), description: t('description') };
}

export default function ConfirmEmailChangeRoute() {
  return (
    <AuthLayout>
      <ConfirmEmailChangeForm />
    </AuthLayout>
  );
}
