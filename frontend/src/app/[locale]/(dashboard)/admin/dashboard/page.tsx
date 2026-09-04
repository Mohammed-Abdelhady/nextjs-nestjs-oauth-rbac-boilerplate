import { RoutePermissionGuard, USER_PERMISSIONS } from '@/modules/permissions';
import type { Metadata } from 'next';

/**
 * Generate metadata for admin dashboard
 */
export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Admin control panel',
};

/**
 * Admin dashboard page
 * Accessible at /[locale]/admin/dashboard
 * Protected by RoutePermissionGuard - requires user management permissions
 */
export default function AdminDashboardPage() {
  return (
    <RoutePermissionGuard permission={USER_PERMISSIONS.LIST_ALL}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin Dashboard</h1>
          <p className="text-lg text-muted-foreground">
            Welcome to the admin control panel. This page is under construction.
          </p>
          <div className="p-6 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Admin features coming soon...</p>
          </div>
        </div>
      </div>
    </RoutePermissionGuard>
  );
}
