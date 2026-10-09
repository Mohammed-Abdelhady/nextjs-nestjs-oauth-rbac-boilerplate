import { AR } from './ar';
import { EN, type MessageKey } from './en';

export type { MessageKey } from './en';

export const LOCALE = { EN: 'en', AR: 'ar' } as const;
export type Locale = (typeof LOCALE)[keyof typeof LOCALE];
export type Direction = 'ltr' | 'rtl';

export const DIRECTION: Record<Locale, Direction> = { en: 'ltr', ar: 'rtl' };

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en: EN, ar: AR };

export type MessageArguments = Readonly<Record<string, string>>;
export type Translate = (key: MessageKey, values?: MessageArguments) => string;

const PLACEHOLDER = /\{(\w+)\}/g;

/** Names of the `{placeholders}` a message takes, sorted. */
export function placeholdersOf(message: string): string[] {
  return [...new Set([...message.matchAll(PLACEHOLDER)].map(([, name]) => name ?? ''))].sort();
}

/** Any Arabic locale tag, such as `ar-SA` or `ar_EG`, reads Arabic. Others read English. */
export function resolveLocale(tag: string | undefined): Locale {
  return /^ar(?:[-_]|$)/i.test(tag ?? '') ? LOCALE.AR : LOCALE.EN;
}

/** A placeholder with no value stays visible, so a missing argument shows up in review. */
export function translate(locale: Locale, key: MessageKey, values: MessageArguments = {}): string {
  return MESSAGES[locale][key].replace(PLACEHOLDER, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? (values[name] ?? placeholder) : placeholder,
  );
}

export function createTranslate(locale: Locale): Translate {
  return (key, values) => translate(locale, key, values);
}
