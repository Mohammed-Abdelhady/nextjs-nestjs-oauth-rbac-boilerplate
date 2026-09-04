import { RoutePermissionGuard, REPORT_PERMISSIONS } from '@/modules/permissions';
import type { Metadata } from 'next';

/**
 * Generate metadata for manager dashboard
 */
export const metadata: Metadata = {
  title: 'Manager Dashboard',
  description: 'Manager control panel',
};

/**
 * Manager dashboard page
 * Accessible at /[locale]/manager/dashboard
 * Protected by RoutePermissionGuard - requires report access permissions
 */
export default function ManagerDashboardPage() {
  return (
    <RoutePermissionGuard permission={REPORT_PERMISSIONS.READ_ALL}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Manager Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">
            Welcome to the manager dashboard. This page is under construction.
          </p>
          <div className="p-6 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Manager features coming soon...</p>
          </div>
        </div>
      </div>
    </RoutePermissionGuard>
  );
}
