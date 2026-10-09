export type Locale = 'en' | 'ar';

export function localeFromLanguageTag(tag: string): Locale {
  return tag.split('-')[0].toLowerCase() === 'ar' ? 'ar' : 'en';
}

export function deviceLocale(): Locale {
  return localeFromLanguageTag(new Intl.DateTimeFormat().resolvedOptions().locale);
}

export function textDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
