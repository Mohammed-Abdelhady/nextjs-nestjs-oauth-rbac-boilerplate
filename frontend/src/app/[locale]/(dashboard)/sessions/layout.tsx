import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * Carries the title for the sessions route. The page itself is a client
 * component and cannot export metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'sessions' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default function SessionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
