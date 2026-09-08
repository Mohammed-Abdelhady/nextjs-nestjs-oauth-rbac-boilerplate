/**
 * Escapes characters with special meaning in regular expressions.
 *
 * @param input - Raw string
 * @returns Escaped string safe for regular expressions
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
