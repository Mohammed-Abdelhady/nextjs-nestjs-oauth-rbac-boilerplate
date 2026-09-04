'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { LoadingRegion } from '@/components/layout/LoadingRegion';
import { useAppSelector } from '@/store/hooks';
import {
  selectIsAuthenticated,
  selectUser,
  selectAuthLoading,
} from '@/modules/auth/store/authSlice';
import { WelcomeModal } from '@/modules/auth/components/WelcomeModal';

interface ActivationGuardProps {
  readonly children: React.ReactNode;
}

/**
 * ActivationGuard component to protect activation route
 * Shows welcome modal if user is already activated
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
  const [showWelcome, setShowWelcome] = useState(true);

  // Dismissing the modal used to leave an empty page behind
  const handleCloseWelcome = useCallback(() => {
    setShowWelcome(false);
    router.push('/auth/login');
  }, [router]);

  if (isAuthLoading) {
    return <LoadingRegion label={t('loading')} testId="activation-guard-loading" />;
  }

  // If authenticated, show welcome modal
  if (isAuthenticated && user) {
    return <WelcomeModal isOpen={showWelcome} userName={user.name} onClose={handleCloseWelcome} />;
  }

  // User is not authenticated, render activation form
  return <>{children}</>;
}
