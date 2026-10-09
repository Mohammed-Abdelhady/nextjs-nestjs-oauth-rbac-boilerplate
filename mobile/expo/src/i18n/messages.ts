import { AR } from './ar';
import { EN, type MessageKey } from './en';

export type { MessageKey } from './en';

export const LOCALE = { EN: 'en', AR: 'ar' } as const;
export type Locale = (typeof LOCALE)[keyof typeof LOCALE];
export type Direction = 'ltr' | 'rtl';

export const DIRECTION: Record<Locale, Direction> = { en: 'ltr', ar: 'rtl' };

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en: EN, ar: AR };

export const VALUE_PLACEHOLDER = '{value}';
export const DETAIL_PLACEHOLDER = '{detail}';

/** Any Arabic locale tag, such as `ar-SA` or `ar_EG`, reads Arabic. Others read English. */
export function resolveLocale(tag: string | undefined): Locale {
  return /^ar(?:[-_]|$)/i.test(tag ?? '') ? LOCALE.AR : LOCALE.EN;
}

export function translate(
  locale: Locale,
  key: MessageKey,
  value?: string,
  detail?: string,
): string {
  const template = MESSAGES[locale][key];
  const withValue =
    value === undefined ? template : template.replace(VALUE_PLACEHOLDER, () => value);
  return detail === undefined ? withValue : withValue.replace(DETAIL_PLACEHOLDER, () => detail);
}
