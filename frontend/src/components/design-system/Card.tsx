import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Visual variant of the card
   * - flat: No shadow, subtle border
   * - elevated: Subtle shadow with hover lift
   * - bordered: Emphasized border with no shadow
   */
  variant?: 'flat' | 'elevated' | 'bordered';

  /**
   * Enable hover interaction effects
   */
  hover?: boolean;

  /**
   * Make card clickable with cursor pointer
   */
  clickable?: boolean;
}

/**
 * Card - Core card component for design system
 *
 * Replaces standard shadcn Card with refined aesthetic:
 * - Nearly invisible borders (--border-subtle)
 * - Subtle shadows instead of heavy borders
 * - Smooth hover transitions
 * - GPU-accelerated animations
 *
 * @example
 * ```tsx
 * <Card variant="elevated" hover>
 *   <h3 className="text-lg font-medium">Title</h3>
 *   <p className="text-sm text-muted-foreground">Description</p>
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'flat', hover = false, clickable = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-testid="card"
        className={cn(
          // Base styles
          'rounded-lg p-4 transition-all duration-200 ease-out',

          // Variant styles
          variant === 'flat' && [
            'bg-card border border-border',
            hover && 'hover:border-input hover:shadow-sm',
          ],

          variant === 'elevated' && [
            'bg-card border border-border shadow-sm',
            hover && 'hover:scale-[1.02] hover:shadow-md',
          ],

          variant === 'bordered' && [
            'bg-card border-2 border-border',
            hover && 'hover:border-primary',
          ],

          // Clickable styles
          clickable && 'cursor-pointer',

          // Custom className
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

/**
 * CardHeader - Optional header section
 */
export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 pb-3', className)} {...props} />
  ),
);

CardHeader.displayName = 'CardHeader';

/**
 * CardTitle - Card title with refined typography
 */
export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-medium tracking-tight leading-none', className)}
      {...props}
    />
  ),
);

CardTitle.displayName = 'CardTitle';

/**
 * CardDescription - Subtle description text
 */
export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground leading-relaxed', className)}
    {...props}
  />
));

CardDescription.displayName = 'CardDescription';

/**
 * CardContent - Main content area
 */
export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('pt-0', className)} {...props} />,
);

CardContent.displayName = 'CardContent';

/**
 * CardFooter - Optional footer section
 */
export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center pt-3 border-t border-border', className)}
      {...props}
    />
  ),
);

CardFooter.displayName = 'CardFooter';
