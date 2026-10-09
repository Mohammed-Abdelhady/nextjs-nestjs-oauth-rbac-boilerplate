export const NATIVE_API_ORIGIN_MESSAGE =
  'API_URL is required when AUTH_NATIVE_ENABLED=true and must be the public http or https origin of this API with no path, query or fragment (https when NODE_ENV=production)';

const NATIVE_API_ORIGIN_PATTERN = /^https?:\/\/[^/?#\\]+\/?$/i;

/** True for an absolute origin a native client can sign DPoP proofs for. */
export function isNativeApiOrigin(value: unknown, nodeEnv: unknown): boolean {
  if (
    typeof value !== 'string' ||
    !NATIVE_API_ORIGIN_PATTERN.test(value) ||
    !URL.canParse(value)
  ) {
    return false;
  }
  const url = new URL(value);
  const schemeAllowed =
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && nodeEnv !== 'production');
  return (
    schemeAllowed &&
    url.hostname.length > 0 &&
    url.username === '' &&
    url.password === '' &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === '' &&
    !value.includes('?') &&
    !value.includes('#')
  );
}
