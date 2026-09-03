'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '../store/authSlice';
import { AuthLayout } from '../components/AuthLayout';
import { RegisterForm } from '../components/RegisterForm';

/**
 * RegisterPage component
 * Renders the registration form within the auth layout
 * Redirects to dashboard if user is already authenticated
 *
 * @example
 * // In Next.js route
 * export default function RegisterRoute() {
 *   return <RegisterPage />;
 * }
 */
export function RegisterPage() {
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    // Redirect to dashboard if already authenticated
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Don't render registration form if already authenticated
  if (isAuthenticated) {
    return null;
  }

  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
