import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { getTranslations } from 'next-intl/server';
import { ReduxProvider, AuthProvider, ThemeProvider } from '@/components/providers';
import { routing } from '@/i18n/routing';
import { getTextDirection } from '@/i18n/direction';
import { APP_NAME } from '@/constants/app';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: 'Authentication and role-based access control boilerplate',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Root layout that wraps ALL pages (including error pages)
 * Provides global CSS, fonts, Redux, and theme support
 * Note: Error pages at root level will use default locale (en)
 */
export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params?: Promise<{ locale?: string }>;
}>) {
  // Extract locale from params if available (for localized routes)
  // Fall back to default locale for root-level error pages
  const locale = params ? ((await params).locale ?? routing.defaultLocale) : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'common' });

  return (
    <html lang={locale} dir={getTextDirection(locale)} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ReduxProvider loadingLabel={t('loading')}>
          <AuthProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </AuthProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
