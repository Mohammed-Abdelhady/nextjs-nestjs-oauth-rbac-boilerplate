'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
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

  // Show nothing while loading auth state
  if (isAuthLoading) {
    return null;
  }

  // Show nothing while redirecting
  if (!isAuthenticated) {
    return null;
  }

  // User is authenticated, render children
  return <>{children}</>;
}
