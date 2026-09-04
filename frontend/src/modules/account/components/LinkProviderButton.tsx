'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLinkProviderMutation } from '../api';
import {
  useGetAuthorizationUrlQuery,
  getOAuthProviderIconPath,
  formatProviderName,
  openOAuthPopup,
  waitForOAuthCallback,
  type OAuthProvider,
} from '@/modules/oauth';
import { parseApiError } from '@/lib/apiError';

interface LinkProviderButtonProps {
  provider: OAuthProvider;
  onLinkSuccess?: () => void;
  disabled?: boolean;
}

/**
 * LinkProviderButton Component
 * Button to initiate OAuth linking flow for a provider
 */
export function LinkProviderButton({
  provider,
  onLinkSuccess,
  disabled = false,
}: LinkProviderButtonProps) {
  const t = useTranslations('settings.accounts');
  const [isLinking, setIsLinking] = useState(false);

  const { data: authUrlData, isLoading: isFetchingUrl } = useGetAuthorizationUrlQuery(provider, {
    skip: isLinking || disabled,
  });

  const [linkProvider] = useLinkProviderMutation();

  const handleLinkClick = async () => {
    if (!authUrlData?.url) {
      toast.error(t('linkError', { provider: formatProviderName(provider) }));
      return;
    }

    try {
      setIsLinking(true);

      const popup = openOAuthPopup(authUrlData.url);
      if (!popup) {
        throw new Error('Failed to open OAuth popup');
      }

      const callbackData = await waitForOAuthCallback(popup);

      await linkProvider({
        provider: callbackData.provider as OAuthProvider,
        code: callbackData.code,
        state: callbackData.state,
      }).unwrap();

      toast.success(t('linkSuccess', { provider: formatProviderName(provider) }));
      onLinkSuccess?.();
    } catch (error: unknown) {
      const parsed = parseApiError(error);
      if (parsed.message === 'OAuth authorization timed out') {
        toast.error(t('linkTimeout'));
      } else if (parsed.message === 'OAuth authorization was cancelled') {
        toast.info(t('linkCancelled'));
      } else {
        toast.error(parsed.message || t('linkError', { provider: formatProviderName(provider) }));
      }
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleLinkClick}
      disabled={disabled || isLinking || isFetchingUrl}
      className="w-fit justify-start"
    >
      {isLinking || isFetchingUrl ? (
        <>
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          <span className="ml-2">
            {t('connecting', { provider: formatProviderName(provider) })}
          </span>
        </>
      ) : (
        <>
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d={getOAuthProviderIconPath(provider)} />
          </svg>
          <span className="ml-2">{t('linkWith', { provider: formatProviderName(provider) })}</span>
        </>
      )}
    </Button>
  );
}
