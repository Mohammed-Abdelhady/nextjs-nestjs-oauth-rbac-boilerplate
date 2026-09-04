import { forwardRef, HTMLAttributes, ReactNode, useState } from 'react';
import { SectionHeader } from '../SectionHeader';
import { cn } from '@/lib/utils';

export interface GroupedGridGroup<T> {
  /**
   * Group identifier
   */
  id: string;

  /**
   * Group title
   */
  title: string;

  /**
   * Items in this group
   */
  items: T[];

  /**
   * Initially collapsed state
   */
  initiallyCollapsed?: boolean;

  /**
   * Action buttons for this group
   */
  actions?: ReactNode;
}

export interface GroupedGridProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Groups of items to render
   */
  groups: GroupedGridGroup<T>[];

  /**
   * Render function for each item
   */
  renderItem: (item: T, index: number) => ReactNode;

  /**
   * Grid columns (responsive breakpoints)
   */
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
  };

  /**
   * Enable stagger animation for items
   */
  stagger?: boolean;

  /**
   * Enable empty state
   */
  emptyState?: ReactNode;
}

/**
 * GroupedGrid - Grid with collapsible groups
 *
 * Features:
 * - Multiple collapsible sections
 * - Responsive grid layout
 * - Smooth expand/collapse animations
 * - Animated counts
 * - Stagger animations
 *
 * @example
 * ```tsx
 * <GroupedGrid
 *   groups={[
 *     {
 *       id: 'verified',
 *       title: 'Verified Users',
 *       items: verifiedUsers,
 *     },
 *     {
 *       id: 'pending',
 *       title: 'Pending Verification',
 *       items: pendingUsers,
 *       initiallyCollapsed: true,
 *     },
 *   ]}
 *   renderItem={(user) => <UserCard user={user} />}
 *   columns={{ md: 2, lg: 3 }}
 *   stagger
 * />
 * ```
 */
export const GroupedGrid = forwardRef(
  <T,>(
    {
      groups,
      renderItem,
      columns = { md: 2, lg: 3 },
      stagger = false,
      emptyState,
      className,
      ...props
    }: GroupedGridProps<T>,
    ref: React.ForwardedRef<HTMLDivElement>,
  ) => {
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
      new Set(groups.filter((g) => g.initiallyCollapsed).map((g) => g.id)),
    );

    const toggleGroup = (groupId: string) => {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(groupId)) {
          next.delete(groupId);
        } else {
          next.add(groupId);
        }
        return next;
      });
    };

    const gridCols = cn(
      'grid gap-4',
      columns.md && `md:grid-cols-${columns.md}`,
      columns.lg && `lg:grid-cols-${columns.lg}`,
    );

    const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);

    if (totalItems === 0 && emptyState) {
      return <div ref={ref}>{emptyState}</div>;
    }

    return (
      <div ref={ref} data-testid="grouped-grid" className={cn('space-y-8', className)} {...props}>
        {groups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.id);

          return (
            <section key={group.id} data-testid={`group-section-${group.id}`} className="space-y-4">
              {/* Group Header */}
              <SectionHeader
                title={group.title}
                count={group.items.length}
                actions={group.actions}
                collapsible
                collapsed={isCollapsed}
                onCollapse={() => toggleGroup(group.id)}
              />

              {/* Group Grid */}
              {!isCollapsed && group.items.length > 0 && (
                <div className={gridCols} data-testid={`group-grid-${group.id}`}>
                  {group.items.map((item, index) => (
                    <div
                      key={index}
                      className={cn(
                        'transition-all duration-300 ease-out',
                        stagger && 'motion-safe:animate-slide-up motion-safe:stagger-animation',
                      )}
                      style={stagger ? ({ '--index': index } as React.CSSProperties) : undefined}
                    >
                      {renderItem(item, index)}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty Group State */}
              {!isCollapsed && group.items.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No items in this group
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  },
) as (<T>(
  props: GroupedGridProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> },
) => React.ReactElement) & { displayName?: string };

GroupedGrid.displayName = 'GroupedGrid';
