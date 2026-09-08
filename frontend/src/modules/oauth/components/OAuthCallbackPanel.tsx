'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { authApi } from '@/modules/auth/store/authApi';
import { useAppDispatch } from '@/store/hooks';
import { useGetEnabledProvidersQuery } from '../api';
import { OAUTH_DEFAULT_ERROR_CODE } from '../constants';
import { getProviderDisplayName } from '../utils';
import type { OAuthCallbackStatus } from '../types';

interface OAuthCallbackPanelProps {
  status: OAuthCallbackStatus;
  errorCode: string;
  providerId: string;
  redirect: string;
}

/**
 * Landing panel for the backend OAuth redirect.
 *
 * On success the session cookie is already set, so the panel only refetches
 * the profile and moves on to the requested page. On failure it shows the
 * message for the error code and waits for the user.
 */
export function OAuthCallbackPanel({
  status,
  errorCode,
  providerId,
  redirect,
}: OAuthCallbackPanelProps) {
  const t = useTranslations('auth.oauth.callback');
  const tCodes = useTranslations('errors.codes');
  const router = useRouter();
  const dispatch = useAppDispatch();
  const hasStarted = useRef(false);
  const [failureCode, setFailureCode] = useState(status === 'ok' ? null : errorCode);

  const { data: providers } = useGetEnabledProvidersQuery(undefined, {
    skip: providerId.length === 0,
  });
  const providerName = getProviderDisplayName(providerId, providers);

  useEffect(() => {
    if (status !== 'ok' || hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    dispatch(authApi.endpoints.getCurrentUser.initiate(undefined, { forceRefetch: true }))
      .unwrap()
      .then(() => router.replace(redirect))
      .catch(() => setFailureCode(OAUTH_DEFAULT_ERROR_CODE));
  }, [dispatch, redirect, router, status]);

  if (failureCode === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center" data-testid="oauth-callback-pending">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('pending')}</p>
        </div>
      </div>
    );
  }

  const message = tCodes.has(failureCode)
    ? tCodes(failureCode, { provider: providerName })
    : tCodes(OAUTH_DEFAULT_ERROR_CODE, { provider: providerName });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center" data-testid="oauth-callback-error">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>

        <h1 className="mb-2 text-2xl font-semibold text-foreground">{t('errorTitle')}</h1>
        <p className="mb-8 text-muted-foreground">{message}</p>

        <Button asChild className="w-full sm:w-auto" data-testid="oauth-back-to-sign-in">
          <Link href="/auth/login">{t('backToSignIn')}</Link>
        </Button>
      </div>
    </div>
  );
}
