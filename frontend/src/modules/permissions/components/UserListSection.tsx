import { memo, ReactNode } from 'react';
import { SectionHeader } from '@/components/design-system';
import { cn } from '@/lib/utils';

export interface UserListSectionProps {
  /**
   * Section identifier
   */
  id: string;

  /**
   * Section title
   */
  title: string;

  /**
   * Number of items in this section
   */
  count: number;

  /**
   * Section content (user cards)
   */
  children: ReactNode;

  /**
   * Optional action buttons
   */
  actions?: ReactNode;

  /**
   * Initially collapsed state
   */
  initiallyCollapsed?: boolean;

  /**
   * Collapsed state (controlled)
   */
  collapsed?: boolean;

  /**
   * Callback when collapse state changes
   */
  onCollapse?: (collapsed: boolean) => void;

  /**
   * Optional className
   */
  className?: string;
}

/**
 * UserListSection - Collapsible section for grouped users
 *
 * Features:
 * - Collapsible header with count
 * - Smooth expand/collapse animations
 * - Optional actions
 * - Grid layout for user cards
 * - Optimized with React.memo
 *
 * @example
 * ```tsx
 * <UserListSection
 *   id="verified"
 *   title="Verified Users"
 *   count={18}
 *   collapsed={isCollapsed}
 *   onCollapse={setIsCollapsed}
 * >
 *   {verifiedUsers.map(user => (
 *     <UserCard key={user._id} user={user} />
 *   ))}
 * </UserListSection>
 * ```
 */
export const UserListSection = memo(function UserListSection({
  id,
  title,
  count,
  children,
  actions,
  collapsed = false,
  onCollapse,
  className,
}: UserListSectionProps) {
  return (
    <section data-testid={`user-list-section-${id}`} className={cn('space-y-4', className)}>
      {/* Section Header */}
      <SectionHeader
        title={title}
        count={count}
        actions={actions}
        collapsible
        collapsed={collapsed}
        onCollapse={onCollapse}
      />

      {/* User Grid - Animated Collapse */}
      {!collapsed && (
        <div
          className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', 'motion-safe:animate-fade-in')}
          data-testid={`user-grid-${id}`}
        >
          {children}
        </div>
      )}

      {/* Empty State */}
      {!collapsed && count === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">No users in this group</div>
      )}
    </section>
  );
});
