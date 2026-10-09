import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  SupportedLocale,
} from '../../../common/constants/locales';

interface LanguagePreference {
  language: string;
  quality: number;
  order: number;
}

export function negotiateNativeAuthorizeLocale(
  acceptLanguage: string | string[] | undefined,
): SupportedLocale {
  const header = Array.isArray(acceptLanguage)
    ? acceptLanguage.join(',')
    : (acceptLanguage ?? '');
  const preferences = header
    .split(',')
    .map(parsePreference)
    .filter((preference) => preference.quality > 0)
    .sort(
      (left, right) => right.quality - left.quality || left.order - right.order,
    );

  for (const preference of preferences) {
    const primaryLanguage = preference.language.split('-')[0].toLowerCase();
    const locale = SUPPORTED_LOCALES.find(
      (supported) => supported === primaryLanguage,
    );
    if (locale) {
      return locale;
    }
  }
  return DEFAULT_LOCALE;
}

function parsePreference(value: string, order: number): LanguagePreference {
  const [rawLanguage, ...parameters] = value.trim().split(';');
  const rawQuality = parameters.find((parameter) =>
    parameter.trim().startsWith('q='),
  );
  const quality = rawQuality
    ? Number.parseFloat(rawQuality.trim().slice(2))
    : 1;

  return {
    language: rawLanguage.trim(),
    quality: Number.isFinite(quality) && quality <= 1 ? quality : 0,
    order,
  };
}
