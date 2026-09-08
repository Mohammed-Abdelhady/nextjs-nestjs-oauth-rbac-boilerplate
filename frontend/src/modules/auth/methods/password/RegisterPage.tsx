'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LogIn } from 'lucide-react';
import { IconLinkButton } from '@/components/ui/icon-link-button';
import { useRouter } from '@/i18n/navigation';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '@/modules/auth/store/authSlice';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { AuthMethodsGate } from '@/modules/auth/components/AuthMethodsGate';
import { RegisterForm } from './RegisterForm';

interface NoPasswordHintProps {
  /** True when a mailed link is what creates the account. */
  createsAccountByLink: boolean;
}

/**
 * Shown where passwords are off. A magic link creates the account by itself;
 * with only OAuth left, the provider does, so the copy differs.
 */
function NoPasswordHint({ createsAccountByLink }: NoPasswordHintProps) {
  const t = useTranslations('auth.register');
  const suffix = createsAccountByLink ? 'magicLinkOnly' : 'providerOnly';

  return (
    <div className="mx-auto mt-8 max-w-xs text-center" data-testid="register-no-password-hint">
      <h2 className="text-lg font-semibold">{t(`${suffix}Title`)}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t(`${suffix}Body`)}</p>
      <IconLinkButton
        href="/auth/login"
        icon={LogIn}
        variant="secondary"
        testId="register-sign-in-link"
        className="mt-4"
        aria-label={t('signIn')}
      >
        {t('signIn')}
      </IconLinkButton>
    </div>
  );
}

/**
 * Registration screen.
 *
 * The form only makes sense where passwords are on. Where the sign-in link is
 * the way in, it creates the account by itself, so this points at sign-in
 * instead of offering a second path.
 */
export function RegisterPage() {
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <AuthLayout>
      <AuthMethodsGate>
        {(methods) =>
          methods.password ? (
            <RegisterForm />
          ) : (
            <NoPasswordHint createsAccountByLink={methods.magicLink} />
          )
        }
      </AuthMethodsGate>
    </AuthLayout>
  );
}
