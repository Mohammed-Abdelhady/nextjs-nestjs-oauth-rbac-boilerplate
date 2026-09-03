'use client';

import { useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  PermissionGuard,
  USER_PERMISSIONS,
  ROLE_PERMISSIONS,
  PERMISSION_PERMISSIONS,
  SESSION_PERMISSIONS,
} from '@/modules/permissions';
import {
  LayoutDashboard,
  Users,
  Shield,
  Settings,
  Activity,
  Code,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  permissions?: string[];
  anyPermissions?: string[];
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  permissions?: string[];
  anyPermissions?: string[];
}

const NAV_SECTIONS: (NavItem | NavSection)[] = [
  // Top-level items (always visible)
  {
    labelKey: 'dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    labelKey: 'settings',
    href: '/settings',
    icon: Settings,
  },

  // Admin Section
  {
    titleKey: 'admin',
    icon: Shield,
    anyPermissions: [
      USER_PERMISSIONS.LIST_ALL,
      ROLE_PERMISSIONS.LIST_ALL,
      PERMISSION_PERMISSIONS.MANAGE_ALL,
    ],
    items: [
      {
        labelKey: 'users',
        href: '/admin/users',
        icon: Users,
        permission: USER_PERMISSIONS.LIST_ALL,
      },
      {
        labelKey: 'roles',
        href: '/admin/roles',
        icon: Shield,
        permission: ROLE_PERMISSIONS.LIST_ALL,
      },
      {
        labelKey: 'permissionsDemo',
        href: '/admin/permissions-demo',
        icon: Code,
        permission: PERMISSION_PERMISSIONS.MANAGE_ALL,
      },
    ],
  },

  // Activity Section
  {
    titleKey: 'activity',
    icon: Activity,
    anyPermissions: [SESSION_PERMISSIONS.READ_ALL, SESSION_PERMISSIONS.READ_OWN],
    items: [
      {
        labelKey: 'sessions',
        href: '/sessions',
        icon: Activity,
        anyPermissions: [SESSION_PERMISSIONS.READ_ALL, SESSION_PERMISSIONS.READ_OWN],
      },
    ],
  },
];

interface DashboardNavProps {
  /**
   * Optional callback when a navigation item is clicked (for mobile auto-close)
   */
  onNavigate?: () => void;
}

/**
 * Dashboard navigation component with permission-based rendering.
 * Only shows navigation items the user has permission to access.
 *
 * @example
 * ```tsx
 * <DashboardNav />
 * // With mobile auto-close
 * <DashboardNav onNavigate={() => setMobileMenuOpen(false)} />
 * ```
 */
function isNavSection(item: NavItem | NavSection): item is NavSection {
  return 'titleKey' in item && 'items' in item;
}

export function DashboardNav({ onNavigate }: DashboardNavProps = {}) {
  const pathname = usePathname();
  const t = useTranslations('dashboard.nav');

  // Manage collapsed state for sections in localStorage
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed-sections');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Ignore parse errors
          return {};
        }
      }
    }
    return {};
  });

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((prev) => {
      const newState = { ...prev, [sectionKey]: !prev[sectionKey] };
      localStorage.setItem('sidebar-collapsed-sections', JSON.stringify(newState));
      return newState;
    });
  };

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive =
      pathname === item.href || (Boolean(pathname) && pathname.startsWith(`${item.href}/`));
    const label = t(item.labelKey);

    const navLink = (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
        data-testid={`nav-link-${item.labelKey}`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );

    // If no permission required, always show
    if (!item.permission && !item.permissions && !item.anyPermissions) {
      return <div key={item.href}>{navLink}</div>;
    }

    // Wrap with permission guard
    return (
      <PermissionGuard
        key={item.href}
        permission={item.permission}
        permissions={item.permissions}
        anyPermissions={item.anyPermissions}
      >
        {navLink}
      </PermissionGuard>
    );
  };

  return (
    <nav className="space-y-1" data-testid="dashboard-nav">
      {NAV_SECTIONS.map((item) => {
        if (isNavSection(item)) {
          // Collapsible Section
          const isCollapsed = collapsedSections[item.titleKey] ?? false;
          const SectionIcon = item.icon;
          const sectionTitle = t(item.titleKey);

          return (
            <PermissionGuard
              key={item.titleKey}
              permission={item.permission}
              permissions={item.permissions}
              anyPermissions={item.anyPermissions}
            >
              <div className="space-y-1">
                {/* Section Header */}
                <button
                  type="button"
                  onClick={() => toggleSection(item.titleKey)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  data-testid={`nav-section-${item.titleKey}`}
                >
                  <div className="flex items-center gap-3">
                    <SectionIcon className="h-4 w-4" />
                    <span>{sectionTitle}</span>
                  </div>
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {/* Section Items */}
                {!isCollapsed && (
                  <div className="ml-4 space-y-1 border-l border-border pl-3">
                    {item.items.map(renderNavItem)}
                  </div>
                )}
              </div>
            </PermissionGuard>
          );
        }

        // Regular nav item (top-level)
        return renderNavItem(item);
      })}
    </nav>
  );
}
