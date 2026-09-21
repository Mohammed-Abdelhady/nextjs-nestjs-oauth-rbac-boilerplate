import type { AbstractIntlMessages } from 'next-intl';
import { routing } from './routing';

export type AppLocale = (typeof routing.locales)[number];

const APP_LOCALES: readonly string[] = routing.locales;

export function isAppLocale(value: string | undefined): value is AppLocale {
  return value !== undefined && APP_LOCALES.includes(value);
}

function isMessageTree(value: unknown): value is AbstractIntlMessages {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function mergeMessageTrees(
  base: AbstractIntlMessages,
  overlay: AbstractIntlMessages,
): AbstractIntlMessages {
  const merged: AbstractIntlMessages = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const existing = merged[key];
    if (isMessageTree(value) && isMessageTree(existing)) {
      merged[key] = mergeMessageTrees(existing, value);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

export async function loadMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  const base = (await import(`./messages/${locale}.json`)).default;
  const overlay = (await import(`./messages/session-authority.${locale}.json`)).default;
  if (!isMessageTree(base) || !isMessageTree(overlay)) {
    throw new Error(`Locale messages for ${locale} are not objects`);
  }
  return mergeMessageTrees(base, overlay);
}
