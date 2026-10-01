/**
 * App Router search parameters arrive repeated, so a single key can be a
 * string or an array. Every page that reads a query value picks the first.
 */
export function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
