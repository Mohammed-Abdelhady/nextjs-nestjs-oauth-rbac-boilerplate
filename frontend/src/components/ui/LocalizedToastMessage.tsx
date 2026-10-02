'use client';

import { useLocale, useTranslations } from 'next-intl';

const UNKNOWN_ERROR = {
  en: 'An unexpected error occurred',
  ar: 'حدث خطأ غير متوقع',
};

/** Render middleware-generated keys within the Toaster's active locale context. */
export function LocalizedToastMessage({ messageKey }: { messageKey: string }) {
  const t = useTranslations();
  const locale = useLocale();
  if (t.has(messageKey)) return t(messageKey);
  if (t.has('toast.error.unknownError')) return t('toast.error.unknownError');
  return locale === 'ar' ? UNKNOWN_ERROR.ar : UNKNOWN_ERROR.en;
}
