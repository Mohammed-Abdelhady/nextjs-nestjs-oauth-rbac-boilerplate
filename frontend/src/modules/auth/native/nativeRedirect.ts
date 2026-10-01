/**
 * Schemes a native app redirect must never use.
 *
 * The address a client is sent to is registered by that client, so custom
 * schemes (`myapp:`) and `https:` are expected. These five are the schemes that
 * run script, read local files or smuggle content in a browser context.
 */
export const UNSAFE_NATIVE_REDIRECT_SCHEMES = [
  'javascript:',
  'data:',
  'vbscript:',
  'blob:',
  'file:',
] as const;

/**
 * True when `address` is a non-empty absolute URL whose scheme is not on the
 * denylist.
 *
 * The value is trimmed and parsed with `new URL`, which strips the tabs,
 * newlines and control characters that could otherwise hide `javascript:`.
 * A relative path has no scheme and is refused too.
 */
export function isSafeNativeRedirect(address: unknown): address is string {
  if (typeof address !== 'string') {
    return false;
  }
  const trimmed = address.trim();
  if (trimmed.length === 0) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  const protocol = parsed.protocol.toLowerCase();
  return !UNSAFE_NATIVE_REDIRECT_SCHEMES.some((scheme) => scheme === protocol);
}
