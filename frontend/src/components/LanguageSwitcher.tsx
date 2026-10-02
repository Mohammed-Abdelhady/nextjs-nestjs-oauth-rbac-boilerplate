'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { FOCUS_RING_CLASSES } from '@/constants/focusStyles';
import { cn } from '@/lib/utils';

const LOCALE_OPTIONS = [
  { locale: 'en', label: 'English', labelKey: 'switchToEnglish' },
  { locale: 'ar', label: 'العربية', labelKey: 'switchToArabic' }, // feature:locale-ar
] as const;

type SwitchableLocale = (typeof LOCALE_OPTIONS)[number]['locale'];

export function LanguageSwitcher() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();

  // Only offer a locale the router actually serves; one is not a choice, so a
  // single-button switcher would do nothing.
  const routed = new Set<string>(routing.locales);
  const options = LOCALE_OPTIONS.filter((option) => routed.has(option.locale));
  if (options.length < 2) return null;

  const handleLanguageChange = (newLocale: SwitchableLocale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex gap-2 items-center" data-testid="language-switcher">
      {options.map(({ locale, label, labelKey }) => {
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
