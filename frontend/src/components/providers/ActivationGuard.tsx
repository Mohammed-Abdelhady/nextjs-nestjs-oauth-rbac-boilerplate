'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { REDIRECT_PARAM } from '@/modules/auth/constants/authMethods';
import { signedInPath } from '@/modules/auth/utils/signInRouting';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { LoadingRegion } from '@/components/layout/LoadingRegion';
import { useAppSelector } from '@/store/hooks';
import {
  selectIsAuthenticated,
  selectUser,
  selectAuthLoading,
} from '@/modules/auth/store/authSlice';

interface ActivationGuardProps {
  readonly children: React.ReactNode;
}

/**
 * ActivationGuard component to protect activation route
 * Sends an already signed-in user through the normal continuation
 * Allows unauthenticated users to proceed with activation
 * Relies on AuthProvider for global session validation
 *
 * @example
 * // In activation page
 * export default function ActivatePage() {
 *   return (
 *     <ActivationGuard>
 *       <ActivationForm />
 *     </ActivationGuard>
 *   );
 * }
 */
export function ActivationGuard({ children }: Readonly<ActivationGuardProps>) {
  const t = useTranslations('common');
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);
  const isAuthLoading = useAppSelector(selectAuthLoading);
  const redirect = useSearchParams().get(REDIRECT_PARAM);

  useEffect(() => {
    if (isAuthenticated && user) router.replace(signedInPath(user, redirect));
  }, [isAuthenticated, user, redirect, router]);

  if (isAuthLoading) {
    return <LoadingRegion label={t('loading')} testId="activation-guard-loading" />;
  }

  if (isAuthenticated && user) return null;

  // User is not authenticated, render activation form
  return <>{children}</>;
}
