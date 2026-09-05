import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { TwoFactorChallengePanel } from '@/modules/two-factor';

type SearchParams = Record<string, string | string[] | undefined>;

interface TwoFactorPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export async function generateMetadata({ params }: TwoFactorPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.twoFactor' });

  return { title: t('title'), description: t('description') };
}

/**
 * Where a sign-in lands when the account owes a code.
 *
 * The password form routes here, and so does the backend after an OAuth or
 * magic link sign-in on a challenged account. The challenge cookie is already
 * set by then, so the page only collects the answer.
 */
export default async function TwoFactorRoute({ searchParams }: TwoFactorPageProps) {
  const query = await searchParams;
  const redirect = firstValue(query.redirect);

  return (
    <AuthLayout>
      <TwoFactorChallengePanel redirect={redirect.length > 0 ? redirect : null} />
    </AuthLayout>
  );
}
