import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Section title
   */
  title: string;

  /**
   * Optional count to display next to title
   */
  count?: number;

  /**
   * Action buttons or elements to display on the right
   */
  actions?: ReactNode;

  /**
   * Make section collapsible
   */
  collapsible?: boolean;

  /**
   * Collapsed state (controlled)
   */
  collapsed?: boolean;

  /**
   * Callback when collapse state changes
   */
  onCollapse?: (collapsed: boolean) => void;
}

/**
 * SectionHeader - Consistent section headers across pages
 *
 * Features:
 * - Uppercase tracking for minimal aesthetic
 * - Optional count badge
 * - Optional action buttons
 * - Optional collapse functionality
 * - Subtle divider line
 *
 * @example
 * ```tsx
 * <SectionHeader
 *   title="Verified Users"
 *   count={18}
 *   actions={<Button size="sm">Add</Button>}
 *   collapsible
 *   collapsed={isCollapsed}
 *   onCollapse={setIsCollapsed}
 * />
 * ```
 */
export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  (
    {
      title,
      count,
      actions,
      collapsible = false,
      collapsed = false,
      onCollapse,
      className,
      ...props
    },
    ref,
  ) => {
    const handleToggle = () => {
      if (collapsible && onCollapse) {
        onCollapse(!collapsed);
      }
    };

    return (
      <div
        ref={ref}
        data-testid="section-header"
        className={cn('pb-3 border-b border-border mb-4', className)}
        {...props}
      >
        <div className="flex items-center justify-between">
          {/* Title with optional collapse */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={!collapsible}
            className={cn(
              'flex items-center gap-2 text-xs uppercase tracking-widest text-tertiary font-medium',
              collapsible && 'hover:text-foreground transition-colors cursor-pointer',
              !collapsible && 'cursor-default',
            )}
            data-testid="section-header-title"
          >
            {collapsible && (
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform duration-200',
                  collapsed && '-rotate-90',
                )}
                data-testid="collapse-icon"
              />
            )}
            <span>
              {title}
              {typeof count === 'number' && <span className="ml-2 text-tertiary">({count})</span>}
            </span>
          </button>

          {/* Actions */}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    );
  },
);

SectionHeader.displayName = 'SectionHeader';
