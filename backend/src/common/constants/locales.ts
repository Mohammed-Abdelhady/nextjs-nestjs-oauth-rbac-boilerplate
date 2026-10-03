export const SUPPORTED_LOCALES = [
  'en',
  'ar', // feature:locale-ar
] as const;
export const DEFAULT_LOCALE = 'en';

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
