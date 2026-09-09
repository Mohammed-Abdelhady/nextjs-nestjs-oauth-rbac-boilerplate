'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useGetCurrentUserQuery } from '../store/authApi';

/**
 * Hook to validate authentication state on app load
 * Checks if user has valid session cookie by calling getCurrentUser API
 * - 401: slice records a failed unauthenticated session; AuthGuard redirects
 * - 403: Redirects to forbidden page (valid session, insufficient permissions)
 *
 * @returns Loading state while validating
 *
 * @example
 * function App() {
 *   const isValidating = useAuthValidation();
 *
 *   if (isValidating) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   return <YourApp />;
 * }
 */
export function useAuthValidation() {
  const router = useRouter();

  // Always call getCurrentUser on mount to check for valid session cookie
  // The backend will return 401 if no valid session exists
  const { isLoading, isError, error } = useGetCurrentUserQuery(undefined, {
    refetchOnMountOrArgChange: true, // Always validate on mount
  });

  useEffect(() => {
    if (isError) {
      const statusCode = (error as { status?: number })?.status;

      if (statusCode === 403) {
        router.push('/403');
      }
    }
  }, [isError, error, router]);

  // Return loading state while validating
  return isLoading;
}
