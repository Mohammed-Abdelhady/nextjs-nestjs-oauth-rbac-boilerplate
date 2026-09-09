export interface SecurityHeader {
  key: string;
  value: string;
}

export interface SecurityHeadersOptions {
  apiUrl?: string;
  isProduction?: boolean;
}

export function extractOrigin(rawUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('/')) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(apiUrl?: string): string {
  const origin = extractOrigin(apiUrl);
  const connectSrc = origin ? `'self' ${origin}` : "'self'";
  const formAction = origin ? `'self' ${origin}` : "'self'";

  const directives: string[] = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action ${formAction}`,
    "object-src 'none'",
  ];

  return directives.join('; ');
}

export function buildSecurityHeaders(options: SecurityHeadersOptions = {}): SecurityHeader[] {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';
  const apiUrl = options.apiUrl ?? process.env.NEXT_PUBLIC_API_URL;

  const headers: SecurityHeader[] = [
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy(apiUrl),
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=()',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
  ];

  if (isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
}
