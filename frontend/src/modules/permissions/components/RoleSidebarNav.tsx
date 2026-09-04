import { memo } from 'react';
import { Lock, Shield } from 'lucide-react';
import { FOCUS_RING_CLASSES } from '@/constants/focusStyles';
import { cn } from '@/lib/utils';
import type { Role } from '../api/rolesApi';

export interface RoleSidebarNavProps {
  /**
   * All available roles
   */
  roles: Role[];

  /**
   * Currently selected role ID
   */
  selectedRoleId: string | null;

  /**
   * Callback when a role is selected
   */
  onSelectRole: (roleId: string) => void;

  /**
   * Loading state
   */
  isLoading?: boolean;
}

/**
 * RoleSidebarNav - Navigation sidebar for roles management
 *
 * Features:
 * - System and custom roles grouped separately
 * - Active role highlighted
 * - System/protected badges
 * - Minimal aesthetic with refined hover states
 *
 * @example
 * ```tsx
 * <RoleSidebarNav
 *   roles={roles}
 *   selectedRoleId={selectedRoleId}
 *   onSelectRole={setSelectedRoleId}
 * />
 * ```
 */
export const RoleSidebarNav = memo(function RoleSidebarNav({
  roles,
  selectedRoleId,
  onSelectRole,
  isLoading = false,
}: RoleSidebarNavProps) {
  // Group roles by type
  const systemRoles = roles.filter((r) => r.isSystemRole);
  const customRoles = roles.filter((r) => !r.isSystemRole);

  if (isLoading) {
    return (
      <nav
        role="status"
        aria-live="polite"
        className="space-y-1"
        data-testid="role-sidebar-nav-loading"
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded-md bg-muted motion-safe:animate-pulse" />
        ))}
      </nav>
    );
  }

  return (
    <nav className="space-y-6" data-testid="role-sidebar-nav">
      {/* System Roles Section */}
      {systemRoles.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-tertiary mb-2 px-3">
            System Roles
          </h2>
          <div className="space-y-1">
            {systemRoles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => onSelectRole(role.id)}
                aria-current={selectedRoleId === role.id ? 'true' : undefined}
                className={cn(
                  'w-full text-start px-3 py-2 rounded-md text-sm transition-all duration-150',
                  'flex items-center gap-2',
                  FOCUS_RING_CLASSES,
                  selectedRoleId === role.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                data-testid={`role-nav-item-${role.slug}`}
              >
                <Shield className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{role.name}</span>
                {role.isProtected && (
                  <Lock className="h-3 w-3 flex-shrink-0 text-status-warning" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Custom Roles Section */}
      {customRoles.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-tertiary mb-2 px-3">
            Custom Roles ({customRoles.length})
          </h2>
          <div className="space-y-1">
            {customRoles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => onSelectRole(role.id)}
                aria-current={selectedRoleId === role.id ? 'true' : undefined}
                className={cn(
                  'w-full text-start px-3 py-2 rounded-md text-sm transition-all duration-150',
                  'flex items-center gap-2',
                  FOCUS_RING_CLASSES,
                  selectedRoleId === role.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                data-testid={`role-nav-item-${role.slug}`}
              >
                <span className="flex-1 truncate">{role.name}</span>
                {role.isProtected && (
                  <Lock className="h-3 w-3 flex-shrink-0 text-status-warning" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {roles.length === 0 && (
        <div className="text-center py-8 px-3">
          <Shield className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No roles available</p>
        </div>
      )}
    </nav>
  );
});
