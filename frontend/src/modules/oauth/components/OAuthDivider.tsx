'use client';

import { useTranslations } from 'next-intl';

interface OAuthDividerProps {
  text?: string;
}

/**
 * OAuthDivider Component
 * Displays a visual divider with text between OAuth buttons and form
 */
export function OAuthDivider({ text }: OAuthDividerProps) {
  const t = useTranslations('auth.oauth');
  const dividerText = text || t('continue');

  return (
    <div className="relative my-6" aria-hidden="true" data-testid="oauth-divider">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">{dividerText}</span>
      </div>
    </div>
  );
}
