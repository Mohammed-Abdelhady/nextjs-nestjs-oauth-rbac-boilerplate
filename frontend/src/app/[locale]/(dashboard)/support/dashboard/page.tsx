import { RoutePermissionGuard, SESSION_PERMISSIONS } from '@/modules/permissions';
import type { Metadata } from 'next';

/**
 * Generate metadata for support dashboard
 */
export const metadata: Metadata = {
  title: 'Support Dashboard',
  description: 'Support control panel',
};

/**
 * Support dashboard page
 * Accessible at /[locale]/support/dashboard
 * Protected by RoutePermissionGuard - requires session management permissions
 */
export default function SupportDashboardPage() {
  return (
    <RoutePermissionGuard permission={SESSION_PERMISSIONS.READ_ALL}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Support Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">
            Welcome to the support dashboard. This page is under construction.
          </p>
          <div className="p-6 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Support features coming soon...</p>
          </div>
        </div>
      </div>
    </RoutePermissionGuard>
  );
}
