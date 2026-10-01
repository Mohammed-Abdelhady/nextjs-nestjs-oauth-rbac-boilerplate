import {
  NATIVE_AUTHORIZE_CLIENT_PATH,
  NATIVE_TRANSACTION_QUERY_KEY,
} from '../../../common/constants/client-paths';
import { SUPPORTED_LOCALES } from '../../../common/constants/locales';
import { sanitizeRedirectPath } from '../../oauth/utils/redirect.util';

const CONTINUATION_BASE_URL = 'https://continuation.invalid';
const NATIVE_AUTHORIZE_PATHS = new Set([
  NATIVE_AUTHORIZE_CLIENT_PATH,
  ...SUPPORTED_LOCALES.map(
    (locale) => `/${locale}${NATIVE_AUTHORIZE_CLIENT_PATH}`,
  ),
]);

export function getAllowedNativeAuthorizeContinuation(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string' || sanitizeRedirectPath(value) !== value) {
    return undefined;
  }

  const queryStart = value.indexOf('?');
  const rawPath = queryStart === -1 ? value : value.slice(0, queryStart);
  if (!NATIVE_AUTHORIZE_PATHS.has(rawPath)) {
    return undefined;
  }

  let target: URL;
  try {
    target = new URL(value, CONTINUATION_BASE_URL);
  } catch {
    return undefined;
  }

  if (
    target.origin !== CONTINUATION_BASE_URL ||
    target.hash.length > 0 ||
    !NATIVE_AUTHORIZE_PATHS.has(target.pathname)
  ) {
    return undefined;
  }

  const query = [...target.searchParams.entries()];
  if (
    query.length !== 1 ||
    query[0][0] !== NATIVE_TRANSACTION_QUERY_KEY ||
    query[0][1].trim().length === 0
  ) {
    return undefined;
  }

  return value;
}
