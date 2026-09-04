/**
 * Common formatting utilities for the application.
 *
 * Every function takes the active locale, which callers read from `useLocale()`
 * on the client or from the route params on the server. There is no default:
 * a missing locale used to mean en-US, which showed English dates on the
 * Arabic pages.
 */

/**
 * Arabic renders with Western digits. The dates sit next to IP addresses,
 * permission codes and ids that stay Latin, and mixing digit systems in one
 * line is harder to read than keeping one.
 */
function resolveLocale(locale: string): string {
  if (locale === 'ar' || locale.startsWith('ar-')) return `${locale}-u-nu-latn`;
  return locale;
}

/**
 * Format a date string to relative time (e.g., "2 hours ago")
 */
export function formatTimeAgo(dateString: string, locale: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(resolveLocale(locale), { numeric: 'auto' });

  if (seconds < 60) {
    return rtf.format(-Math.max(1, seconds), 'second');
  }
  if (seconds < 3600) {
    return rtf.format(-Math.floor(seconds / 60), 'minute');
  }
  if (seconds < 86400) {
    return rtf.format(-Math.floor(seconds / 3600), 'hour');
  }
  if (seconds < 2592000) {
    return rtf.format(-Math.floor(seconds / 86400), 'day');
  }
  if (seconds < 31536000) {
    return rtf.format(-Math.floor(seconds / 2592000), 'month');
  }
  return rtf.format(-Math.floor(seconds / 31536000), 'year');
}

/**
 * Format a date to short format (e.g., "Jan 2024")
 */
export function formatDateShort(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleDateString(resolveLocale(locale), {
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date to long format (e.g., "January 15, 2024")
 */
export function formatDateLong(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleDateString(resolveLocale(locale), {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Generate initials from a name (e.g., "John Doe" -> "JD")
 */
export function getInitials(name: string, maxLength = 2): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, maxLength);
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a number with digit grouping (e.g., 1000 -> "1,000")
 */
export function formatNumber(value: number, locale: string): string {
  return value.toLocaleString(resolveLocale(locale));
}
