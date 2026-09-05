'use client';

import { Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UserPlus } from 'lucide-react';
import { IconLinkButton } from '@/components/ui/icon-link-button';
import { OAuthButtons, OAuthDivider } from '@/modules/oauth';
import { enabledAuthMethods } from '../methods/registry';
import type { AuthMethods } from '../types/auth.types';
import { AuthMethodsGate } from './AuthMethodsGate';

interface SignInMethodsProps {
  methods: AuthMethods;
  redirect: string | null;
}

/**
 * OAuth buttons first, then one form per enabled method with a divider between
 * them. A deployment with a single method gets that method on its own.
 */
function SignInMethods({ methods, redirect }: SignInMethodsProps) {
  const t = useTranslations('auth.login');
  const entries = enabledAuthMethods(methods);
  const hasOAuth = methods.oauth.length > 0;

  return (
    <>
      {methods.password && (
        <div className="flex flex-col items-center">
          <IconLinkButton
            href="/auth/register"
            icon={UserPlus}
            variant="secondary"
            testId="signup-link"
            aria-label={t('signUp')}
          >
            {t('signUp')}
          </IconLinkButton>
        </div>
      )}

      {hasOAuth && (
        <div className="my-6">
          <OAuthButtons redirect={redirect ?? undefined} />
        </div>
      )}

      {entries.map(({ id, Form }, index) => (
        <Fragment key={id}>
          {(index > 0 || hasOAuth) && <OAuthDivider />}
          <Form redirect={redirect} isOnlyMethod={entries.length === 1} />
        </Fragment>
      ))}
    </>
  );
}

/**
 * The sign-in screen. It asks the backend which methods are on and renders
 * only those, so a password field never appears where passwords are off.
 */
export function LoginForm() {
  const t = useTranslations('auth.login');
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  return (
    <section className="mt-12 flex flex-col items-center" aria-labelledby="login-heading">
      <h1
        id="login-heading"
        className="text-2xl xl:text-3xl font-extrabold text-foreground"
        data-testid="login-title"
      >
        {t('title')}
      </h1>

      <div className="mt-8 w-full flex-1">
        <AuthMethodsGate>
          {(methods) => <SignInMethods methods={methods} redirect={redirect} />}
        </AuthMethodsGate>
      </div>
    </section>
  );
}
