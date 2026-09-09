'use client';

import { useTranslations } from 'next-intl';

interface AuthDividerProps {
  text?: string;
}

/**
 * The "or continue with" rule between two ways of signing in. Lives in the
 * shared components because every sign-in method stacks under it, not only
 * the OAuth buttons it was written for.
 */
export function AuthDivider({ text }: AuthDividerProps) {
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
