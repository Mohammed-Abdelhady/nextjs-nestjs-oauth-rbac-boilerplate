'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthMethods } from '../hooks/useAuthMethods';
import type { AuthMethods } from '../types/auth.types';

interface AuthMethodsGateProps {
  /** Rendered once the enabled methods are known. */
  children: (methods: AuthMethods) => ReactNode;
}

/**
 * Holds an auth screen back until the backend has said which sign-in methods
 * it runs, so no form appears that the deployment would reject.
 */
export function AuthMethodsGate({ children }: AuthMethodsGateProps) {
  const t = useTranslations('auth.methods');
  const { methods, isLoading } = useAuthMethods();

  if (isLoading || methods === undefined) {
    return (
      <div className="mx-auto mt-8 w-full max-w-xs space-y-4" data-testid="auth-methods-loading">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (!methods.password && !methods.magicLink && methods.oauth.length === 0) {
    return (
      <p
        className="mx-auto mt-8 max-w-xs text-center text-sm text-muted-foreground"
        role="status"
        data-testid="auth-methods-empty"
      >
        {t('noneEnabled')}
      </p>
    );
  }

  return <>{children(methods)}</>;
}
