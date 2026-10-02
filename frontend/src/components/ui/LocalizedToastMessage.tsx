'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl'; // feature:locale-ar

const UNKNOWN_ERROR = {
  en: 'An unexpected error occurred',
  ar: 'حدث خطأ غير متوقع', // feature:locale-ar
};

/** Render middleware-generated keys within the Toaster's active locale context. */
export function LocalizedToastMessage({ messageKey }: { messageKey: string }) {
  const t = useTranslations();
  const locale = useLocale(); // feature:locale-ar
  if (t.has(messageKey)) return t(messageKey);
  if (t.has('toast.error.unknownError')) return t('toast.error.unknownError');
  if (locale === 'ar') return UNKNOWN_ERROR.ar; // feature:locale-ar
  return UNKNOWN_ERROR.en;
}
