'use client';

import { Heading } from '@/components/design-system';
import { Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UserPlus } from 'lucide-react';
import { AuthDivider } from '@/components/ui/auth-divider';
import { IconLinkButton } from '@/components/ui/icon-link-button';
import { OAuthButtons } from '@/modules/oauth'; // feature:oauth-core
import { enabledAuthMethods } from '../methods/registry';
import type { AuthMethods } from '@app/sdk';
import { AuthMethodsGate } from './AuthMethodsGate';
import { REGISTER_PATH, REDIRECT_PARAM, CONFIRM_EMAIL_CHANGE_PATH } from '../constants/authMethods';
import { authPagePath } from '../utils/signInRouting';
import { Link } from '@/i18n/navigation';

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
            href={authPagePath(REGISTER_PATH, redirect)}
            icon={UserPlus}
            variant="secondary"
            testId="signup-link"
            aria-label={t('signUp')}
          >
            {t('signUp')}
          </IconLinkButton>
        </div>
      )}

      {/* feature:oauth-core:start */}
      {hasOAuth && (
        <div className="my-6">
          <OAuthButtons redirect={redirect ?? undefined} />
        </div>
      )}
      {/* feature:oauth-core:end */}

      {entries.map(({ id, Form }, index) => (
        <Fragment key={id}>
          {(index > 0 || hasOAuth) && <AuthDivider />}
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
  const redirect = searchParams.get(REDIRECT_PARAM);

  return (
    <section className="mt-12 flex flex-col items-center" aria-labelledby="login-heading">
      <Heading
        level={1}
        variant="display"
        id="login-heading"

        data-testid="login-title"
      >
        {t('title')}
      </Heading>

      <div className="mt-8 w-full flex-1">
        <AuthMethodsGate>
          {(methods) => <SignInMethods methods={methods} redirect={redirect} />}
        </AuthMethodsGate>
        <div className="mt-6 text-center">
          <Link
            href={CONFIRM_EMAIL_CHANGE_PATH}
            className="text-sm font-semibold text-primary hover:underline"
            data-testid="confirm-new-email-link"
          >
            {t('confirmNewEmail')}
          </Link>
        </div>
      </div>
    </section>
  );
}
