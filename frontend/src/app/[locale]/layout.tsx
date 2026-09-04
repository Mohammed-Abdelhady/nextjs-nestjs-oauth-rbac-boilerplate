import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { DirectionProvider } from '@/components/providers';
import { getTextDirection } from '@/i18n/direction';

/**
 * Locale-specific layout that adds i18n support.
 * Wraps pages with NextIntlClientProvider and the direction-aware providers.
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

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <DirectionProvider dir={getTextDirection(locale)}>{children}</DirectionProvider>
    </NextIntlClientProvider>
  );
}
