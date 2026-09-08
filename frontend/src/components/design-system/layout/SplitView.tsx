import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SplitViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  /**
   * Sidebar content (left side)
   */
  sidebar: ReactNode;

  /**
   * Main content (right side)
   */
  content: ReactNode;

  /**
   * Sidebar width as percentage or pixels
   */
  sidebarWidth?: string;

  /**
   * Make sidebar sticky
   */
  stickySidebar?: boolean;
}

/**
 * SplitView - Responsive sidebar + content layout
 *
 * Features:
 * - Desktop: Side-by-side layout
 * - Mobile: Stacked layout (sidebar on top)
 * - Optional sticky sidebar
 * - Configurable sidebar width
 * - Smooth transitions
 *
 * @example
 * ```tsx
 * <SplitView
 *   sidebar={<RoleSidebarNav roles={roles} />}
 *   content={<RoleDetailPanel role={selectedRole} />}
 *   sidebarWidth="25%"
 *   stickySidebar
 * />
 * ```
 */
export const SplitView = forwardRef<HTMLDivElement, SplitViewProps>(
  ({ sidebar, content, sidebarWidth = '25%', stickySidebar = true, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-testid="split-view"
        className={cn('flex flex-col md:flex-row gap-6', className)}
        {...props}
      >
        {/* Sidebar */}
        <aside
          className={cn(
            'md:w-[var(--sidebar-width)]',
            stickySidebar && 'md:sticky md:top-0 md:self-start md:max-h-screen md:overflow-y-auto',
          )}
          style={{ '--sidebar-width': sidebarWidth } as React.CSSProperties}
          data-testid="split-view-sidebar"
        >
          {sidebar}
        </aside>

        {/* Content pane. Not a <main>: the page layout owns the single one */}
        <div className="flex-1 min-w-0" data-testid="split-view-content">
          {content}
        </div>
      </div>
    );
  },
);

SplitView.displayName = 'SplitView';
