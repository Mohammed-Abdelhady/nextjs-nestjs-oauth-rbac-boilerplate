import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * Carries the title for the roles route. The page itself is a client component
 * and cannot export metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'roles' });

  return { title: t('title') };
}

export default function RolesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
