'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '@/modules/auth/store/authSlice';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { ForgotPasswordForm } from './ForgotPasswordForm';

/**
 * ForgotPasswordPage component
 * Renders the password reset request form within the auth layout
 * Redirects to dashboard if user is already authenticated
 *
 * @example
 * // In Next.js route
 * export default function ForgotPasswordRoute() {
 *   return <ForgotPasswordPage />;
 * }
 */
export function ForgotPasswordPage() {
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    // Redirect to dashboard if already authenticated
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Don't render form if already authenticated
  if (isAuthenticated) {
    return null;
  }

  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
