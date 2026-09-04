/**
 * Text direction helpers shared by the root layout, the locale layout and
 * anything that needs to mirror layout for right-to-left locales.
 */

export type TextDirection = 'ltr' | 'rtl';

const RTL_LOCALES = new Set<string>(['ar']);

export function getTextDirection(locale: string): TextDirection {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}
