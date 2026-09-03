'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();

  const handleLanguageChange = (newLocale: 'en' | 'ar') => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex gap-2 items-center">
      <button
        type="button"
        onClick={() => handleLanguageChange('en')}
        data-testid="language-switcher-en"
        className={`px-3 py-1 rounded ${
          currentLocale === 'en'
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground'
        }`}
        aria-label="Switch to English"
      >
        English
      </button>
      <button
        type="button"
        onClick={() => handleLanguageChange('ar')}
        data-testid="language-switcher-ar"
        className={`px-3 py-1 rounded ${
          currentLocale === 'ar'
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground'
        }`}
        aria-label="Switch to Arabic"
      >
        العربية
      </button>
    </div>
  );
}
