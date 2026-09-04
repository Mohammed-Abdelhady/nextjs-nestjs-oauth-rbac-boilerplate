'use client';

import type { LucideIcon } from 'lucide-react';

interface ErrorPageLayoutProps {
  code: string;
  title: string;
  description: string;
  subtitle: string;
  icon: LucideIcon;
  variant: 'primary' | 'destructive';
  actions: React.ReactNode;
  errorDigest?: string;
  errorIdLabel?: string;
}

/**
 * Shared split-screen layout for error pages.
 * Left: Error content with actions | Right: Decorative illustration
 */
export function ErrorPageLayout({
  code,
  title,
  description,
  subtitle,
  icon: Icon,
  variant,
  actions,
  errorDigest,
  errorIdLabel,
}: ErrorPageLayoutProps) {
  const colorClass = variant === 'primary' ? 'text-primary' : 'text-destructive';
  const bgClass = variant === 'primary' ? 'bg-primary/10' : 'bg-destructive/10';
  const iconColorClass =
    variant === 'primary' ? 'text-primary opacity-30' : 'text-destructive opacity-30';
  const subtitleColorClass = variant === 'primary' ? 'text-primary' : 'text-destructive';

  return (
    <div className="min-h-screen bg-background text-foreground flex justify-center">
      <div className="max-w-screen-xl m-0 sm:m-20 bg-card shadow sm:rounded-lg flex justify-center flex-1">
        {/* Start Side - Error Content */}
        <div className="lg:w-1/2 xl:w-5/12 p-6 sm:p-12 flex flex-col justify-center">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-start">
            {/* Error Code */}
            <div className="mb-6">
              <h2 className={`text-8xl font-extrabold ${colorClass}`}>{code}</h2>
            </div>

            {/* Title */}
            <h1 className="text-3xl xl:text-4xl font-extrabold text-foreground mb-4">{title}</h1>

            {/* Description */}
            <p className="text-lg text-muted-foreground mb-4 max-w-md">{description}</p>

            {/* Error Digest (if available, for debugging) */}
            {errorDigest && (
              <p className="text-sm text-muted-foreground mb-8 font-mono bg-muted px-3 py-2 rounded max-w-md">
                {errorIdLabel}: {errorDigest}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-4">{actions}</div>
          </div>
        </div>

        {/* Right Side - Illustration */}
        <div className={`flex-1 ${bgClass} text-center hidden lg:flex items-center justify-center`}>
          <div className="flex flex-col items-center justify-center p-12">
            <Icon className={`w-64 h-64 ${iconColorClass}`} strokeWidth={1} aria-hidden="true" />
            <p className={`mt-8 text-xl font-semibold ${subtitleColorClass}`}>{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
