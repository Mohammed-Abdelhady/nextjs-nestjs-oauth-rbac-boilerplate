import * as React from 'react';
import { Link } from '@/i18n/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconLinkButtonProps {
  href: string;
  icon: LucideIcon;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  testId?: string;
  className?: string;
}

/**
 * IconLinkButton - A reusable link component styled as a button with an icon
 *
 * @example
 * <IconLinkButton
 *   href="/auth/register"
 *   icon={UserPlus}
 *   variant="secondary"
 *   testId="signup-link"
 * >
 *   Sign Up
 * </IconLinkButton>
 */
export function IconLinkButton({
  href,
  icon: Icon,
  children,
  variant = 'secondary',
  testId,
  className,
}: IconLinkButtonProps) {
  const variantStyles = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  };

  const iconStyles = {
    primary: 'text-primary-foreground',
    secondary: 'text-primary', // Accent color for visual hierarchy
  };

  return (
    <Link
      href={href}
      className={cn(
        'h-14 w-full max-w-xs font-bold shadow-sm rounded-lg py-3 flex items-center justify-center transition-all duration-300 ease-in-out focus:outline-none hover:shadow focus:shadow-sm focus:shadow-outline',
        variantStyles[variant],
        className,
      )}
      data-testid={testId ?? 'icon-link-button'}
    >
      <Icon className={cn('w-6 h-6 -ms-2', iconStyles[variant])} />
      <span className="ms-4">{children}</span>
    </Link>
  );
}
