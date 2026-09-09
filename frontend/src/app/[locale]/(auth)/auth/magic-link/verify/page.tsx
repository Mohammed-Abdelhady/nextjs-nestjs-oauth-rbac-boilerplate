import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { MagicLinkVerifyPanel } from '@/modules/auth/methods/magic-link';

type SearchParams = Record<string, string | string[] | undefined>;

interface MagicLinkVerifyPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export async function generateMetadata({ params }: MagicLinkVerifyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.magicLink.verify' });

  return { title: t('title'), description: t('pending') };
}

/**
 * Landing route of a mailed sign-in link.
 *
 * The token arrives in the query string and is read here, so the client panel
 * gets it as a prop and needs no Suspense boundary of its own.
 */
export default async function MagicLinkVerifyRoute({ searchParams }: MagicLinkVerifyPageProps) {
  const query = await searchParams;
  const redirect = firstValue(query.redirect);

  return (
    <AuthLayout>
      <MagicLinkVerifyPanel
        token={firstValue(query.token)}
        redirect={redirect.length > 0 ? redirect : null}
      />
    </AuthLayout>
  );
}
