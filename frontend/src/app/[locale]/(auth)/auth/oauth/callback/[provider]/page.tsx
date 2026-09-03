'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useHandleCallbackMutation, OAuthProvider } from '@/modules/oauth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * OAuth Callback Page with Dynamic Provider
 * Handles provider-specific callback URLs:
 * - /auth/oauth/callback/google
 * - /auth/oauth/callback/github
 * - /auth/oauth/callback/facebook
 */
export default function OAuthProviderCallbackPage() {
  const t = useTranslations('auth.oauth.callback');
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [handleCallback, { isLoading }] = useHandleCallbackMutation();
  const [isProcessing, setIsProcessing] = useState(true);

  // Extract provider from URL path
  const provider = params.provider as OAuthProvider;

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Validate provider
        const validProviders: OAuthProvider[] = ['google', 'github', 'facebook'];
        if (!validProviders.includes(provider)) {
          throw new Error(`Invalid OAuth provider: ${provider}`);
        }

        // Check for error in URL params first (OAuth provider returned error)
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
          setIsProcessing(false);
          const errorMessage = errorDescription || `OAuth error: ${error}`;
          toast.error(errorMessage);

          // If in popup, notify parent window
          if (window.opener) {
            window.close();
          } else {
            // Redirect to login with error after a delay
            setTimeout(() => {
              router.push('/auth/login?error=oauth_failed');
            }, 2000);
          }
          return;
        }

        // Get code and state from URL params
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        // If we have code and state in URL (direct redirect from OAuth provider)
        if (code && state) {
          // Check if this is a popup window
          if (window.opener) {
            // Send data back to parent window via postMessage
            window.opener.postMessage(
              {
                type: 'oauth_callback',
                code,
                state,
                provider, // Use provider from URL path
              },
              window.location.origin,
            );

            // Close the popup
            window.close();
            return;
          }

          // Not a popup, process directly
          await handleCallback({
            provider,
            code,
            state,
          }).unwrap();

          // Show success message
          toast.success(t('success'));

          // Redirect to dashboard after successful authentication
          setTimeout(() => {
            router.push('/dashboard');
          }, 500);
          return;
        }

        // If no code/state, something went wrong
        throw new Error('No authorization code received from OAuth provider');
      } catch (error) {
        console.error('OAuth callback error:', error);
        setIsProcessing(false);
        toast.error(t('error'));

        // If in popup, just close it
        if (window.opener) {
          window.close();
        } else {
          // Redirect to login with error after a delay
          setTimeout(() => {
            router.push('/auth/login?error=oauth_failed');
          }, 2000);
        }
      }
    };

    processCallback();
  }, [handleCallback, router, searchParams, provider, t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center" data-testid="oauth-callback-page">
        {isProcessing || isLoading ? (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h1 className="mt-4 text-2xl font-semibold text-foreground">{t('title')}</h1>
            <p className="mt-2 text-muted-foreground">Completing {provider} authentication...</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <svg
                className="h-6 w-6 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0m-9 0v.01"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-destructive">{t('error')}</h1>
            <p className="mt-2 text-muted-foreground">Redirecting you back to login page...</p>
          </>
        )}
      </div>
    </div>
  );
}
