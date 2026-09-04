import type { Metadata } from 'next';

/**
 * Generate metadata for user dashboard
 */
export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your personal dashboard',
};

/**
 * User dashboard page
 * Accessible at /[locale]/dashboard
 * Protected by AuthGuard in layout
 */
export default function DashboardPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-lg text-muted-foreground">
          Welcome to your dashboard. This page is under construction.
        </p>
        <div className="p-6 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Dashboard features coming soon...</p>
        </div>
      </div>
    </div>
  );
}
