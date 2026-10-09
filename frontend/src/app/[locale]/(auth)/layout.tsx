import { LanguageSwitcher } from '@/components/LanguageSwitcher'; // feature:locale-ar
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

/**
 * Route layout for authentication pages.
 * Displays top bar with language and theme switchers.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <header className="absolute inset-x-0 top-0 z-50 flex items-center justify-end gap-2 p-4">
        <LanguageSwitcher /> {/* feature:locale-ar */}
        <ThemeSwitcher />
      </header>
      <main id="main" tabIndex={-1} className="focus-visible:outline-none" data-testid="auth-main">
        {children}
      </main>
    </div>
  );
}
