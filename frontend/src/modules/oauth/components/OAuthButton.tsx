'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGetAuthorizationUrlQuery, useHandleCallbackMutation } from '../api';
import type { OAuthProvider } from '../types';
import {
  formatProviderName,
  getOAuthProviderIconPath,
  getProviderStyles,
  openOAuthPopup,
  waitForOAuthCallback,
} from '../utils';

interface OAuthButtonProps {
  provider: OAuthProvider;
  mode?: 'signin' | 'link';
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

/**
 * OAuthButton Component
 * Displays an icon-only button for OAuth authentication with a specific provider
 */
export function OAuthButton({ provider, onSuccess, onError, disabled = false }: OAuthButtonProps) {
  const t = useTranslations('auth.oauth');
  const tCallback = useTranslations('auth.oauth.callback');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const { data: authUrlData, isLoading: isFetchingUrl } = useGetAuthorizationUrlQuery(provider, {
    skip: isLoading || disabled,
  });

  const [handleOAuthCallback] = useHandleCallbackMutation();

  const handleOAuthClick = async () => {
    if (!authUrlData?.url) {
      toast.error(t('error', { provider: formatProviderName(provider) }));
      onError?.(t('error', { provider: formatProviderName(provider) }));
      return;
    }

    try {
      setIsLoading(true);

      const popup = openOAuthPopup(authUrlData.url);

      if (!popup) {
        throw new Error('Failed to open OAuth popup');
      }

      const callbackData = await waitForOAuthCallback(popup);

      if (!callbackData || !callbackData.code) {
        throw new Error('Invalid OAuth callback data');
      }

      await handleOAuthCallback({
        provider: callbackData.provider,
        code: callbackData.code,
        state: callbackData.state,
      }).unwrap();

      toast.success(tCallback('success'));

      setTimeout(() => {
        router.push('/dashboard');
      }, 500);

      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'OAuth authentication failed';
      toast.error(t('error', { provider: formatProviderName(provider) }));
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const { bgColor, hoverColor, textColor, borderColor } = getProviderStyles(provider);
  const providerName = formatProviderName(provider);

  return (
    <button
      type="button"
      onClick={handleOAuthClick}
      disabled={disabled || isLoading || isFetchingUrl}
      className={`
        group relative inline-flex h-14 w-14 items-center justify-center rounded-full
        transition-all duration-200 ease-in-out
        ${bgColor} ${textColor} ${borderColor}
        ${!disabled && !isLoading && !isFetchingUrl ? hoverColor : ''}
        ${disabled || isLoading || isFetchingUrl ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        disabled:pointer-events-none
      `}
      aria-label={t('signInWith', { provider: providerName })}
      title={t('signInWith', { provider: providerName })}
      data-testid={`oauth-${provider}-button`}
    >
      {isLoading || isFetchingUrl ? (
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      ) : (
        <svg
          className="h-6 w-6 transition-transform duration-200 group-hover:scale-110"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d={getOAuthProviderIconPath(provider)} />
        </svg>
      )}

      <span
        className="
        absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap
        rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white
        opacity-0 transition-opacity duration-200
        group-hover:opacity-100
        pointer-events-none z-50
        shadow-lg
      "
      >
        {providerName}
        <span
          className="
          absolute -bottom-1 left-1/2 -translate-x-1/2
          h-2 w-2 rotate-45 bg-gray-900
        "
        />
      </span>
    </button>
  );
}
