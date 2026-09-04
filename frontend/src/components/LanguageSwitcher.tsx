'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { FOCUS_RING_CLASSES } from '@/constants/focusStyles';
import { cn } from '@/lib/utils';

type SwitchableLocale = 'en' | 'ar';

interface LocaleOption {
  locale: SwitchableLocale;
  /** Written in its own language, so it carries its own `lang`. */
  label: string;
  labelKey: 'switchToEnglish' | 'switchToArabic';
}

const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { locale: 'en', label: 'English', labelKey: 'switchToEnglish' },
  { locale: 'ar', label: 'العربية', labelKey: 'switchToArabic' },
];

export function LanguageSwitcher() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();

  const handleLanguageChange = (newLocale: SwitchableLocale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex gap-2 items-center">
      {LOCALE_OPTIONS.map(({ locale, label, labelKey }) => {
        const isCurrent = currentLocale === locale;

        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => handleLanguageChange(locale)}
            aria-current={isCurrent ? 'true' : undefined}
            aria-label={t(labelKey)}
            data-testid={`language-switcher-${locale}`}
            className={cn(
              'rounded px-3 py-1 text-sm',
              isCurrent
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground',
              FOCUS_RING_CLASSES,
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
