import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { AuthProvider, DirectionProvider } from '@/components/providers';
import { FOCUS_RING_CLASSES } from '@/constants/focusStyles';
import { getTextDirection } from '@/i18n/direction';
import { cn } from '@/lib/utils';

/**
 * Locale-specific layout that adds i18n support.
 * Wraps pages with NextIntlClientProvider and the direction-aware providers,
 * and opens every page with the skip link that jumps to `main#main`.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: 'common' });

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <DirectionProvider dir={getTextDirection(locale)}>
        <a
          href="#main"
          className={cn(
            'sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-sm',
            FOCUS_RING_CLASSES,
          )}
          data-testid="skip-to-content-link"
        >
          {t('skipToContent')}
        </a>
        <AuthProvider>{children}</AuthProvider>
      </DirectionProvider>
    </NextIntlClientProvider>
  );
}
