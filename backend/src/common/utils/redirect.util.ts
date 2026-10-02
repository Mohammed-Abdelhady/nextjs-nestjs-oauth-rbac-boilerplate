import { DEFAULT_REDIRECT_PATH } from '../constants/client-paths';

const MAX_REDIRECT_LENGTH = 512;
const RELATIVE_PATH = /^\/(?![/\\])[\w\-./~%?&=+#[\]@!$'()*,;:]*$/;

/**
 * Keeps only single slash relative paths. Everything else, including
 * protocol relative `//host` and absolute URLs, collapses to the default path.
 */
export function sanitizeRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    return DEFAULT_REDIRECT_PATH;
  }
  if (value.length > MAX_REDIRECT_LENGTH || value.includes('://')) {
    return DEFAULT_REDIRECT_PATH;
  }
  if (!RELATIVE_PATH.test(value)) {
    return DEFAULT_REDIRECT_PATH;
  }
  return value;
}
