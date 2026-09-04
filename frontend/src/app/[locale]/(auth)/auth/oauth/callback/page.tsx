import { getRedirectPath } from '@/modules/auth/utils';
import { OAuthCallbackPanel, OAUTH_DEFAULT_ERROR_CODE } from '@/modules/oauth';
import type { OAuthCallbackStatus } from '@/modules/oauth';

type SearchParams = Record<string, string | string[] | undefined>;

interface OAuthCallbackPageProps {
  searchParams: Promise<SearchParams>;
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

/**
 * Landing route of the backend OAuth redirect.
 *
 * The backend appends status, and on failure the error code and provider id.
 * Anything else, including a bare visit, counts as a failed sign-in.
 */
export default async function OAuthCallbackPage({ searchParams }: OAuthCallbackPageProps) {
  const params = await searchParams;
  const status: OAuthCallbackStatus = firstValue(params.status) === 'ok' ? 'ok' : 'error';
  const errorCode = firstValue(params.code) || OAUTH_DEFAULT_ERROR_CODE;

  return (
    <OAuthCallbackPanel
      status={status}
      errorCode={errorCode}
      providerId={firstValue(params.provider)}
      redirect={getRedirectPath(firstValue(params.redirect))}
    />
  );
}
