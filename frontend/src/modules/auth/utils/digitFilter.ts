/**
 * Strips non-digit characters from a string and truncates to maximum length.
 *
 * @param value - Raw input string
 * @param maxLength - Maximum allowed digits (default 6)
 * @returns Digits-only string with length up to maxLength
 */
export function filterDigits(value: string, maxLength = 6): string {
  if (!value) {
    return '';
  }
  return value.replace(/\D/g, '').slice(0, maxLength);
}
