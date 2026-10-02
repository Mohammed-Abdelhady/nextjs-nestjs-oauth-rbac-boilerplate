import { isIP } from 'node:net';
import { DISALLOWED_REDIRECT_URI_SCHEMES } from '../constants/redirect-uri';

export function isAcceptableRedirectUri(value: unknown): value is string {
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
  if (scheme !== 'http') {
    return true;
  }

  return isLoopbackHost(parsed.hostname);
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
