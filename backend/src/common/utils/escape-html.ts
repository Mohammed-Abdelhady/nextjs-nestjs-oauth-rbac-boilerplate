const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes characters that carry meaning in HTML.
 * Apply to every value that reaches an HTML template from user input.
 *
 * @param input - Raw string
 * @returns String safe to place in HTML text and in quoted attributes
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
