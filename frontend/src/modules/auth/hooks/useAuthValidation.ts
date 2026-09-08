'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAppDispatch } from '@/store/hooks';
import { useGetCurrentUserQuery } from '../store/authApi';
import { logout } from '../store/authSlice';

/**
 * Hook to validate authentication state on app load
 * Checks if user has valid session cookie by calling getCurrentUser API
 * - 401: Logs out user (invalid/expired session)
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
  const dispatch = useAppDispatch();
  const router = useRouter();

  // Always call getCurrentUser on mount to check for valid session cookie
  // The backend will return 401 if no valid session exists
  const { isLoading, isError, error } = useGetCurrentUserQuery(undefined, {
    refetchOnMountOrArgChange: true, // Always validate on mount
  });

  useEffect(() => {
    if (isError) {
      const statusCode = (error as { status?: number })?.status;

      if (statusCode === 401) {
        // Unauthorized: Invalid or expired session - logout
        dispatch(logout());
      } else if (statusCode === 403) {
        // Forbidden: Valid session but insufficient permissions - redirect
        router.push('/403');
      }
      // Other errors (network, 500, etc.) are ignored - user can retry
    }
  }, [isError, error, dispatch, router]);

  // Return loading state while validating
  return isLoading;
}
