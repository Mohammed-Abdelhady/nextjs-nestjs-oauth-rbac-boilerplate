import { FETCH_SITE } from '../constants/browser-proof';

export type OriginDecision =
  | { ok: true }
  | {
      ok: false;
      reason: 'cross-site' | 'missing-origin' | 'null-origin' | 'unlisted';
    };

export function decideOrigin(input: {
  originHeader: string;
  refererHeader: string;
  fetchSite: string;
  allowedOrigins: readonly string[];
}): OriginDecision {
  const fetchSite = input.fetchSite.trim().toLowerCase();
  if (fetchSite === FETCH_SITE.CROSS_SITE) {
    return { ok: false, reason: 'cross-site' };
  }

  const presented = presentedOrigin(input.originHeader, input.refererHeader);
  if (presented === null) {
    return { ok: false, reason: 'null-origin' };
  }
  if (presented === undefined) {
    if (fetchSite === FETCH_SITE.SAME_SITE) {
      return { ok: false, reason: 'missing-origin' };
    }
    return { ok: true };
  }

  const allowed = new Set(input.allowedOrigins.map(normalizeOrigin));
  if (!allowed.has(presented)) {
    return { ok: false, reason: 'unlisted' };
  }
  return { ok: true };
}

function presentedOrigin(
  originHeader: string,
  refererHeader: string,
): string | null | undefined {
  const origin = originHeader.trim();
  if (origin.length > 0) {
    if (origin.toLowerCase() === 'null') {
      return null;
    }
    return normalizeOrigin(origin);
  }

  const referer = refererHeader.trim();
  if (referer.length === 0) {
    return undefined;
  }
  return normalizeOrigin(referer);
}

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
