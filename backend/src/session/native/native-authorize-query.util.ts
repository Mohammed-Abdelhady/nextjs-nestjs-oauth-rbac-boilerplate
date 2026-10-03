import type { AuthorizeQuery } from './native-oauth.types';

export const REQUIRED_AUTHORIZE_QUERY_KEYS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'state',
] as const;

export function isValidAuthorizeQueryShape(
  value: unknown,
): value is AuthorizeQuery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value);
  if (
    entries.some(([, entry]) => typeof entry !== 'string' || entry.length === 0)
  ) {
    return false;
  }

  const keys = new Set(entries.map(([key]) => key));
  return REQUIRED_AUTHORIZE_QUERY_KEYS.every((key) => keys.has(key));
}
