import { isIP } from 'node:net';
import { DISALLOWED_REDIRECT_URI_SCHEMES } from '../../constants/redirect-uri';

export interface RedirectUriPolicy {
  nodeEnv?: string;
  allowCustomScheme?: boolean;
}

export function isAcceptableRedirectUri(
  value: unknown,
  policy: RedirectUriPolicy = {},
): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  const scheme = parsed.protocol.slice(0, -1).toLowerCase();
  if (
    parsed.href.includes('#') ||
    DISALLOWED_REDIRECT_URI_SCHEMES.has(scheme)
  ) {
    return false;
  }
  if (scheme === 'https') {
    return true;
  }
  if (scheme === 'http') {
    return isLoopbackHost(parsed.hostname);
  }
  if (policy.nodeEnv === 'production' && policy.allowCustomScheme !== true) {
    return false;
  }
  return true;
}

/**
 * Checks a return address the client sent against one registered address.
 *
 * Non-loopback addresses match exactly. A registered loopback address
 * (`http` on `localhost`, the `127.0.0.0/8` range or `[::1]`) matches on
 * scheme, host and path with any port accepted, as RFC 8252 section 7.3
 * requires. Anything narrower, including `*.localhost` names the operating
 * system is not guaranteed to resolve to loopback, matches exactly.
 * A fragment on either side never matches.
 */
export function matchesRegisteredRedirectUri(
  registered: string,
  requested: string,
): boolean {
  if (registered.includes('#') || requested.includes('#')) {
    return false;
  }
  if (registered === requested) {
    return true;
  }
  let registeredUrl: URL;
  let requestedUrl: URL;
  try {
    registeredUrl = new URL(registered);
    requestedUrl = new URL(requested);
  } catch {
    return false;
  }
  if (
    registeredUrl.protocol !== 'http:' ||
    !isAnyPortLoopbackHost(registeredUrl.hostname)
  ) {
    return false;
  }
  return (
    requestedUrl.protocol === 'http:' &&
    requestedUrl.hostname === registeredUrl.hostname &&
    requestedUrl.username === registeredUrl.username &&
    requestedUrl.password === registeredUrl.password &&
    requestedUrl.pathname === registeredUrl.pathname &&
    requestedUrl.search === registeredUrl.search
  );
}

/**
 * Hosts any-port matching applies to. The URL parser already normalises the
 * `127.1`, `0x7f.1`, `2130706433`, trailing-dot and case variants to these
 * forms before this runs.
 */
function isAnyPortLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost') {
    return true;
  }
  const address = normalized.replace(/^\[|\]$/g, '');
  if (address === '::1') {
    return true;
  }
  return (
    isIP(address) === 4 && Number.parseInt(address.split('.')[0], 10) === 127
  );
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    return true;
  }

  const address = normalized.replace(/^\[|\]$/g, '');
  const family = isIP(address);
  return family === 6
    ? address === '::1'
    : family === 4 && Number.parseInt(address.split('.')[0], 10) === 127;
}
