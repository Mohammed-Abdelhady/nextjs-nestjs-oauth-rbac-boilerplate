'use client';

import {
  PermissionGuard,
  RoutePermissionGuard,
  USER_PERMISSIONS,
  ROLE_PERMISSIONS,
  SESSION_PERMISSIONS,
  PERMISSION_PERMISSIONS,
  WILDCARD_PERMISSION,
} from '@/modules/permissions';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Unlock, Users, Settings, Trash2, Edit, Eye } from 'lucide-react';

/**
 * Permissions Demo Page
 *
 * This page demonstrates various ways to use the permission system:
 * - Component-level guards (hide elements)
 * - Route-level guards (protect entire pages)
 * - Multiple permission checks
 * - Action button protection
 */
export default function PermissionsDemoPage() {
  return (
    <RoutePermissionGuard permission={PERMISSION_PERMISSIONS.MANAGE_ALL}>
      <div className="container mx-auto max-w-6xl space-y-8 py-8">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-8">
            Permissions System Demo
          </h1>
          <p className="mt-2 text-muted-foreground">
            This page demonstrates how to use permission guards throughout the application.
          </p>
        </div>

        {/* Single Permission Guard */}
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Single Permission Guard</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Elements wrapped in PermissionGuard are completely hidden if the user lacks permission.
          </p>

          <div className="space-y-2">
            <PermissionGuard permission={USER_PERMISSIONS.LIST_ALL}>
              <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 dark:bg-green-950">
                <Unlock className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-800 dark:text-green-200">
                  ✓ You have USER_PERMISSIONS.LIST_ALL - this element is visible
                </span>
              </div>
            </PermissionGuard>

            <PermissionGuard permission="fake:permission:that:nobody:has">
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 dark:bg-red-950">
                <Lock className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-800 dark:text-red-200">
                  ✗ This element requires fake:permission - you will never see this
                </span>
              </div>
            </PermissionGuard>
          </div>
        </section>

        {/* Multiple Permissions (ALL) */}
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Multiple Permissions (Require ALL)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Use the <code className="rounded bg-muted px-1">permissions</code> prop to require ALL
            listed permissions.
          </p>

          <PermissionGuard permissions={[USER_PERMISSIONS.LIST_ALL, ROLE_PERMISSIONS.LIST_ALL]}>
            <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 dark:bg-green-950">
              <Unlock className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-800 dark:text-green-200">
                ✓ You have both USER_PERMISSIONS.LIST_ALL AND ROLE_PERMISSIONS.LIST_ALL
              </span>
            </div>
          </PermissionGuard>

          <PermissionGuard permissions={[USER_PERMISSIONS.LIST_ALL, 'fake:permission']}>
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 dark:bg-red-950">
              <Lock className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-800 dark:text-red-200">
                ✗ This requires fake:permission - hidden even if you have one permission
              </span>
            </div>
          </PermissionGuard>
        </section>

        {/* Any Permissions (OR) */}
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Any Permissions (Require ANY)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Use the <code className="rounded bg-muted px-1">anyPermissions</code> prop to show if
            user has ANY of the listed permissions.
          </p>

          <PermissionGuard
            anyPermissions={[SESSION_PERMISSIONS.READ_ALL, SESSION_PERMISSIONS.READ_OWN]}
          >
            <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 dark:bg-green-950">
              <Unlock className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-800 dark:text-green-200">
                ✓ You have either READ_ALL or READ_OWN session permissions
              </span>
            </div>
          </PermissionGuard>
        </section>

        {/* Action Buttons with Permission Guards */}
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Action Buttons with Permission Guards</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Wrap action buttons with PermissionGuard to completely hide unauthorized actions.
          </p>

          {/* Sample user card */}
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                  <Users className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-medium">John Doe</p>
                  <p className="text-sm text-muted-foreground">john@example.com</p>
                </div>
              </div>

              {/* Action buttons - only shown if user has permissions */}
              <div className="flex gap-2">
                <PermissionGuard permission={USER_PERMISSIONS.READ_ALL}>
                  <Button size="sm" variant="outline">
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                </PermissionGuard>

                <PermissionGuard permission={USER_PERMISSIONS.UPDATE_ALL}>
                  <Button size="sm" variant="outline">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </PermissionGuard>

                <PermissionGuard permission={USER_PERMISSIONS.DELETE_ALL}>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </PermissionGuard>
              </div>
            </div>
          </div>

          <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>Tip:</strong> Notice how buttons are completely hidden, not just disabled.
              This prevents users from seeing actions they can&apos;t perform.
            </p>
          </div>
        </section>

        {/* Fallback Content */}
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Fallback Content</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Use the <code className="rounded bg-muted px-1">fallback</code> prop to show alternative
            content when permission is denied.
          </p>

          <PermissionGuard
            permission="this:permission:does:not:exist"
            fallback={
              <div className="rounded-md border border-dashed border-muted-foreground/50 p-4 text-center">
                <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  You don&apos;t have permission to view this content.
                </p>
              </div>
            }
          >
            <div className="rounded-md bg-green-50 p-4 dark:bg-green-950">
              <p className="text-sm text-green-800 dark:text-green-200">
                This secret content is only for authorized users!
              </p>
            </div>
          </PermissionGuard>
        </section>

        {/* Wildcard Permission */}
        <section className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-100">
              Wildcard Permission (*)
            </h2>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            The wildcard permission grants access to everything. Only assign to super admin users.
          </p>

          <PermissionGuard permission={WILDCARD_PERMISSION}>
            <div className="rounded-md bg-amber-100 p-4 dark:bg-amber-900">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                ⚠️ You have wildcard permission - you can see and do everything!
              </p>
            </div>
          </PermissionGuard>
        </section>

        {/* Code Examples */}
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Code Examples</h2>

          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Component-level Guard:</h3>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
                {`import { PermissionGuard, USER_PERMISSIONS } from '@/modules/permissions';

<PermissionGuard permission={USER_PERMISSIONS.DELETE_ALL}>
  <Button variant="destructive">Delete User</Button>
</PermissionGuard>`}
              </pre>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Route-level Guard:</h3>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
                {`import { RoutePermissionGuard, ROLE_PERMISSIONS } from '@/modules/permissions';

export default function RolesPage() {
  return (
    <RoutePermissionGuard permission={ROLE_PERMISSIONS.MANAGE_ALL}>
      <RoleManagementUI />
    </RoutePermissionGuard>
  );
}`}
              </pre>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Multiple Permissions (ALL):</h3>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
                {`<PermissionGuard
  permissions={[USER_PERMISSIONS.LIST_ALL, ROLE_PERMISSIONS.LIST_ALL]}
>
  <AdminPanel />
</PermissionGuard>`}
              </pre>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Any Permissions (OR):</h3>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
                {`<PermissionGuard
  anyPermissions={[SESSION_PERMISSIONS.READ_ALL, SESSION_PERMISSIONS.READ_OWN]}
>
  <SessionsList />
</PermissionGuard>`}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </RoutePermissionGuard>
  );
}
