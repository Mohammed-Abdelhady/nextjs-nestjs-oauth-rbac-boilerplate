'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

/**
 * OAuth Error Page
 * Displays user-friendly error message when OAuth authentication fails
 */
export default function OAuthErrorPage() {
  const t = useTranslations('auth.oauth');
  const router = useRouter();

  const handleTryAgain = () => {
    router.push('/auth/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center" data-testid="oauth-error-page">
        {/* Error Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>

        {/* Error Message */}
        <h1 className="mb-2 text-3xl font-bold text-foreground">OAuth Authentication Failed</h1>

        <p className="mb-6 text-lg text-muted-foreground">
          {t('error', { provider: 'OAuth Provider' })}
        </p>

        {/* Helpful Information */}
        <div className="mb-8 rounded-lg bg-muted/50 p-6 text-start">
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            What might have gone wrong:
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start">
              <span className="me-2 text-destructive">•</span>
              <span>You may have cancelled the authorization</span>
            </li>
            <li className="flex items-start">
              <span className="me-2 text-destructive">•</span>
              <span>The authorization may have timed out</span>
            </li>
            <li className="flex items-start">
              <span className="me-2 text-destructive">•</span>
              <span>There might be a temporary issue with the OAuth provider</span>
            </li>
            <li className="flex items-start">
              <span className="me-2 text-destructive">•</span>
              <span>Your account may already be linked to another account</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={handleTryAgain}
            className="w-full sm:w-auto"
            data-testid="try-again-button"
          >
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/')}
            className="w-full sm:w-auto"
            data-testid="go-home-button"
          >
            Go to Home
          </Button>
        </div>

        {/* Additional Help */}
        <p className="mt-6 text-sm text-muted-foreground">
          If the problem persists, please{' '}
          <Link
            href="/contact"
            data-testid="contact-support-link"
            className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            contact support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
