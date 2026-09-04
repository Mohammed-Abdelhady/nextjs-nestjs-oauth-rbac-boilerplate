import { forwardRef, HTMLAttributes, ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface FloatingActionZoneProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Action buttons or elements to display
   */
  actions: ReactNode;

  /**
   * Position on screen
   */
  position?:
    | 'bottom-right'
    | 'bottom-left'
    | 'top-right'
    | 'top-left'
    | 'bottom-end'
    | 'bottom-start'
    | 'top-end'
    | 'top-start';

  /**
   * Only show after scrolling
   */
  showOnScroll?: boolean;

  /**
   * Scroll threshold in pixels (only applies if showOnScroll is true)
   */
  scrollThreshold?: number;
}

/**
 * FloatingActionZone - Fixed action area for batch operations
 *
 * Features:
 * - Fixed positioning in corners
 * - Fade in on scroll (optional)
 * - Elevated shadow for depth
 * - Responsive placement
 * - Smooth animations
 *
 * @example
 * ```tsx
 * <FloatingActionZone
 *   position="bottom-right"
 *   showOnScroll
 *   scrollThreshold={100}
 *   actions={
 *     <>
 *       <Button>Select All</Button>
 *       <Button variant="destructive">Delete Selected</Button>
 *     </>
 *   }
 * />
 * ```
 */
export const FloatingActionZone = forwardRef<HTMLDivElement, FloatingActionZoneProps>(
  (
    {
      actions,
      position = 'bottom-right',
      showOnScroll = false,
      scrollThreshold = 100,
      className,
      ...props
    },
    ref,
  ) => {
    const [isVisible, setIsVisible] = useState(!showOnScroll);

    useEffect(() => {
      if (!showOnScroll) return;

      const handleScroll = () => {
        const scrollY = window.scrollY;
        setIsVisible(scrollY > scrollThreshold);
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll(); // Check initial scroll position

      return () => window.removeEventListener('scroll', handleScroll);
    }, [showOnScroll, scrollThreshold]);

    const positionClasses: Record<NonNullable<FloatingActionZoneProps['position']>, string> = {
      'bottom-right': 'bottom-6 end-6',
      'bottom-left': 'bottom-6 start-6',
      'top-right': 'top-6 end-6',
      'top-left': 'top-6 start-6',
      'bottom-end': 'bottom-6 end-6',
      'bottom-start': 'bottom-6 start-6',
      'top-end': 'top-6 end-6',
      'top-start': 'top-6 start-6',
    };

    return (
      <div
        ref={ref}
        data-testid="floating-action-zone"
        className={cn(
          'fixed z-40',
          'flex items-center gap-2 p-3',
          'bg-card border border-border rounded-lg shadow-lg',
          'transition-all duration-300 ease-out',
          positionClasses[position],
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none',
          className,
        )}
        {...props}
      >
        {actions}
      </div>
    );
  },
);

FloatingActionZone.displayName = 'FloatingActionZone';
