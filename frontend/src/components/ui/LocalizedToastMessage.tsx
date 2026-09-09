'use client';

import { useLocale, useTranslations } from 'next-intl';

const UNKNOWN_ERROR = {
  en: 'An unexpected error occurred',
  ar: 'حدث خطأ غير متوقع',
};

/** Render middleware-generated keys within the Toaster's active locale context. */
export function LocalizedToastMessage({ messageKey }: { messageKey: string }) {
  const t = useTranslations('toast');
  const locale = useLocale();
  const key = messageKey.replace(/^toast\./, '');
  if (t.has(key)) return t(key);
  if (t.has('error.unknownError')) return t('error.unknownError');
  return locale === 'ar' ? UNKNOWN_ERROR.ar : UNKNOWN_ERROR.en;
}
