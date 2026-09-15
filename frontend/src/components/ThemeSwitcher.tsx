'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeSwitcher() {
  const t = useTranslations('common');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-9" />; // Skeleton to prevent layout shift
  }

  const isLight = theme === 'light';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      aria-label={isLight ? t('switchToDarkMode') : t('switchToLightMode')}
      data-testid="theme-switcher"
    >
      {isLight ? (
        <Moon className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Sun className="h-5 w-5" aria-hidden="true" />
      )}
    </Button>
  );
}
