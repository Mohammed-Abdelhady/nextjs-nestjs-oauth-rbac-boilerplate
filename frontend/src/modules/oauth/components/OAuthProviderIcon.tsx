import { cn } from '@/lib/utils';
import { getProviderMeta } from '../constants';

interface OAuthProviderIconProps {
  providerId: string;
  displayName: string;
  className?: string;
}

/**
 * Brand icon for a provider. Providers this build has no icon for show the
 * first letter of their display name instead.
 */
export function OAuthProviderIcon({ providerId, displayName, className }: OAuthProviderIconProps) {
  const { iconPath } = getProviderMeta(providerId);

  if (iconPath.length === 0) {
    return (
      <span
        className={cn('inline-flex items-center justify-center font-semibold', className)}
        aria-hidden="true"
      >
        {displayName.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={iconPath} />
    </svg>
  );
}
