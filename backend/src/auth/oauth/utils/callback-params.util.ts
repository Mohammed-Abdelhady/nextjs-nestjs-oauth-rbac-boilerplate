import { OAuthCallbackParams } from '../oauth-provider.interface';

/**
 * Narrows a parsed query string or form body to string values.
 *
 * Express hands back arrays for repeated keys and objects for bracket
 * notation. Neither is a valid OAuth parameter, so both are dropped rather
 * than coerced.
 */
export function toCallbackParams(source: unknown): OAuthCallbackParams {
  if (typeof source !== 'object' || source === null) {
    return {};
  }

  const params: OAuthCallbackParams = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') {
      params[key] = value;
    }
  }

  return params;
}
