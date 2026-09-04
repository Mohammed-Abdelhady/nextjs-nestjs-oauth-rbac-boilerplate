import { cn } from '@/lib/utils';

export interface FieldErrorProps {
  /** Referenced by the field through `aria-describedby`. */
  id: string;

  /** Nothing renders while this is empty. */
  message?: string;

  className?: string;

  testId?: string;
}

/**
 * Error text under a field that is not wired to react-hook-form. Dialogs with
 * local validation state use it to link their messages to the input.
 */
export function FieldError({
  id,
  message,
  className,
  testId,
}: FieldErrorProps): React.JSX.Element | null {
  if (!message) return null;

  return (
    <p id={id} className={cn('text-xs text-destructive', className)} data-testid={testId}>
      {message}
    </p>
  );
}
