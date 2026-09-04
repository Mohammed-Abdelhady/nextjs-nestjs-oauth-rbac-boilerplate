'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { LoadingRegion } from '@/components/layout/LoadingRegion';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated, selectAuthLoading } from '@/modules/auth/store/authSlice';

interface AuthGuardProps {
  readonly children: React.ReactNode;
}

/**
 * AuthGuard component to protect routes requiring authentication
 * Redirects unauthenticated users to login page with return URL
 * Relies on AuthProvider for global session validation
 *
 * @example
 * // In a protected page
 * export default function DashboardPage() {
 *   return (
 *     <AuthGuard>
 *       <Dashboard />
 *     </AuthGuard>
 *   );
 * }
 */
export function AuthGuard({ children }: Readonly<AuthGuardProps>) {
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isAuthLoading = useAppSelector(selectAuthLoading);

  useEffect(() => {
    // Wait for auth state to be determined
    if (isAuthLoading) {
      return;
    }

    // If not authenticated, redirect to login with return URL
    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/auth/login?redirect=${returnUrl}`);
    }
  }, [isAuthenticated, isAuthLoading, pathname, router]);

  // Announce the wait instead of leaving a blank screen, both while the auth
  // state resolves and while the redirect to login is in flight
  if (isAuthLoading || !isAuthenticated) {
    return <LoadingRegion label={t('loading')} testId="auth-guard-loading" />;
  }

  // User is authenticated, render children
  return <>{children}</>;
}
