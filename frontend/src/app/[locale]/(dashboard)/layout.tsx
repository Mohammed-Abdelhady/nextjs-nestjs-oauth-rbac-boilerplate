'use client';

import { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/providers/AuthGuard';
import { DashboardNav } from '@/components/navigation/DashboardNav';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LogoutButton } from '@/modules/auth/components/LogoutButton';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/modules/auth/store/authSlice';

/**
 * Dashboard layout with sidebar navigation.
 * Wraps all dashboard pages with authentication and navigation.
 * Responsive with mobile hamburger menu.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = useAppSelector(selectUser);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Handle Escape key to close mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        closeMobileMenu();
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        {/* Desktop Sidebar Navigation - Hidden on mobile */}
        <aside className="fixed start-0 top-0 z-40 hidden h-screen w-64 border-e border-border bg-background md:block">
          <div className="flex h-full flex-col">
            {/* Logo/Brand */}
            <div className="flex h-16 items-center border-b border-border px-6">
              <h1 className="text-xl font-bold text-foreground">Auth App</h1>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto p-4">
              <DashboardNav />
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4">
              <p className="text-xs text-muted-foreground">© 2024 Auth App</p>
            </div>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background px-4 md:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              data-testid="mobile-menu-button"
            >
              <Menu className="h-6 w-6" />
            </Button>
            <h1 className="ms-2 text-xl font-bold text-foreground">Auth App</h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
            <LogoutButton />
          </div>
        </div>

        {/* Mobile Sidebar - Slide-out drawer */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-50 bg-black/50 md:hidden"
              onClick={closeMobileMenu}
              data-testid="mobile-menu-backdrop"
            />

            {/* Sidebar Drawer */}
            <aside
              className="fixed start-0 top-0 z-50 h-screen w-64 border-e border-border bg-background ltr:animate-in ltr:slide-in-from-left rtl:animate-in rtl:slide-in-from-right duration-200 md:hidden"
              data-testid="mobile-sidebar"
            >
              <div className="flex h-full flex-col">
                {/* Header with Close Button */}
                <div className="flex h-16 items-center justify-between border-b border-border px-4">
                  <h1 className="text-xl font-bold text-foreground">Auth App</h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeMobileMenu}
                    aria-label="Close menu"
                    data-testid="mobile-menu-close"
                  >
                    <X className="h-6 w-6" />
                  </Button>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto p-4">
                  <DashboardNav onNavigate={closeMobileMenu} />
                </div>

                {/* Footer */}
                <div className="border-t border-border p-4">
                  <p className="text-xs text-muted-foreground">© 2024 Auth App</p>
                </div>
              </div>
            </aside>
          </>
        )}

        {/* Main Content */}
        <div className="flex min-h-screen flex-1 flex-col md:ms-64">
          {/* Desktop Header Row */}
          <header className="hidden h-16 items-center justify-end border-b border-border bg-background px-6 md:flex">
            <div className="flex items-center gap-2">
              {user && (
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <span className="text-sm font-medium text-foreground">{user.name}</span>
                  <span className="text-xs text-muted-foreground">({user.role})</span>
                </div>
              )}
              <LanguageSwitcher />
              <ThemeSwitcher />
              <LogoutButton />
            </div>
          </header>

          <main className="flex-1 pt-16 md:pt-0">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
