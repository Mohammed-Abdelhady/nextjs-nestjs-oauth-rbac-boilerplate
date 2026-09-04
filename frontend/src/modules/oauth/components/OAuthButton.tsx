'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { FOCUS_RING_CLASSES } from '@/constants/focusStyles';
import { cn } from '@/lib/utils';
import { getProviderMeta } from '../constants';
import { currentRedirectPath, startOAuthFlow } from '../utils';
import type { OAuthProviderSummary } from '../types';
import { OAuthProviderIcon } from './OAuthProviderIcon';

interface OAuthButtonProps {
  provider: OAuthProviderSummary;
  /** Path to return to after sign-in. Defaults to the page's redirect parameter. */
  redirect?: string;
  disabled?: boolean;
}

/**
 * Icon-only button that hands sign-in over to the backend start route.
 * The click leaves the page: the backend needs to set a state cookie before
 * it redirects to the provider.
 */
export function OAuthButton({ provider, redirect, disabled = false }: OAuthButtonProps) {
  const t = useTranslations('auth.oauth');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { buttonClassName, hoverClassName } = getProviderMeta(provider.id);

  const handleClick = () => {
    setIsRedirecting(true);
    startOAuthFlow(provider.id, redirect ?? currentRedirectPath());
  };

  const isBusy = disabled || isRedirecting;
  const label = t('signInWith', { provider: provider.displayName });

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isBusy}
      aria-busy={isRedirecting}
      className={cn(
        'group relative inline-flex h-14 w-14 items-center justify-center rounded-full',
        'transition-all duration-200 ease-in-out',
        FOCUS_RING_CLASSES,
        'disabled:pointer-events-none',
        buttonClassName,
        isBusy ? 'cursor-not-allowed opacity-50' : `cursor-pointer ${hoverClassName}`,
      )}
      aria-label={label}
      title={label}
      data-testid={`oauth-${provider.id}-button`}
    >
      {isRedirecting ? (
        <Loader2 className="h-6 w-6 motion-safe:animate-spin" aria-hidden="true" />
      ) : (
        <OAuthProviderIcon
          providerId={provider.id}
          displayName={provider.displayName}
          className="h-6 w-6 transition-transform duration-200 group-hover:scale-110"
        />
      )}

      <span
        className="
        absolute -top-10 start-1/2 ltr:-translate-x-1/2 rtl:translate-x-1/2 whitespace-nowrap
        rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white
        opacity-0 transition-opacity duration-200
        group-hover:opacity-100 group-focus-within:opacity-100
        pointer-events-none z-50
        shadow-lg
      "
      >
        {provider.displayName}
        <span
          className="
          absolute -bottom-1 start-1/2 ltr:-translate-x-1/2 rtl:translate-x-1/2
          h-2 w-2 rotate-45 bg-gray-900
        "
        />
      </span>
    </button>
  );
}
