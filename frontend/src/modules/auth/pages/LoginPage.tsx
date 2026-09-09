'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated, selectUser } from '../store/authSlice';
import { signedInPath } from '../utils/signInRouting';
import { REDIRECT_PARAM } from '../constants/authMethods';
import { AuthLayout } from '../components/AuthLayout';
import { LoginForm } from '../components/LoginForm';

/**
 * LoginPage component
 * Renders the login form within the auth layout
 * Redirects to dashboard if user is already authenticated
 *
 * @example
 * // In Next.js route
 * export default function LoginRoute() {
 *   return <LoginPage />;
 * }
 */
export function LoginPage() {
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);
  const redirect = useSearchParams().get(REDIRECT_PARAM);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(signedInPath(user, redirect));
    }
  }, [isAuthenticated, user, redirect, router]);

  // Don't render login form if already authenticated
  if (isAuthenticated) {
    return null;
  }

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
