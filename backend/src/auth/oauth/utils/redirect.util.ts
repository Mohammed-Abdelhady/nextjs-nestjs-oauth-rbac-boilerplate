import { OAUTH_DEFAULT_REDIRECT } from '../oauth.constants';

const MAX_REDIRECT_LENGTH = 512;
const RELATIVE_PATH = /^\/(?![/\\])[\w\-./~%?&=+#[\]@!$'()*,;:]*$/;

/**
 * Keeps only single slash relative paths. Everything else, including
 * protocol relative `//host` and absolute URLs, collapses to '/'.
 */
export function sanitizeRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    return OAUTH_DEFAULT_REDIRECT;
  }
  if (value.length > MAX_REDIRECT_LENGTH || value.includes('://')) {
    return OAUTH_DEFAULT_REDIRECT;
  }
  if (!RELATIVE_PATH.test(value)) {
    return OAUTH_DEFAULT_REDIRECT;
  }
  return value;
}
