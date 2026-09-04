import * as React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SubmitButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
  icon?: LucideIcon;
  testId?: string;
}

export function SubmitButton({
  isLoading = false,
  loadingText,
  icon: Icon,
  testId,
  children,
  className,
  disabled,
  ...props
}: SubmitButtonProps): React.JSX.Element {
  return (
    <Button
      type="submit"
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      data-testid={testId}
      className={cn(
        'h-14 mt-5 tracking-wide font-semibold w-full py-4 rounded-lg transition-all duration-300 ease-in-out flex items-center justify-center',
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-6 h-6 -ms-2 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="w-6 h-6 -ms-2" aria-hidden="true" />
      )}
      <span className="ms-3">{children}</span>
      {isLoading && (
        <span className="sr-only">{loadingText ? ` (${loadingText})` : ' (loading)'}</span>
      )}
    </Button>
  );
}
