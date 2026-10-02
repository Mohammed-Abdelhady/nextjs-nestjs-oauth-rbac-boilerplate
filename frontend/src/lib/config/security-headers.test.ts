import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  extractOrigin,
  type SecurityHeadersOptions,
} from './security-headers';

// Written out by hand. The production strings are the policy as it shipped
// before development got its own script-src.
const PRODUCTION_CSP_SAME_ORIGIN =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
const PRODUCTION_CSP_WITH_API =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://api.example.com; object-src 'none'";
const DEVELOPMENT_CSP_WITH_API =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://api.example.com; object-src 'none'";

describe('security-headers', () => {
  describe('extractOrigin', () => {
    it('extracts origin from full http url', () => {
      expect(extractOrigin('http://localhost:5000')).toBe('http://localhost:5000');
    });

    it('extracts origin from full https url with path and query', () => {
      expect(extractOrigin('https://api.example.com:8443/v1/auth?client=web')).toBe(
        'https://api.example.com:8443',
      );
    });

    it('returns null for relative urls', () => {
      expect(extractOrigin('/api/v1')).toBeNull();
    });

    it('returns null for empty or undefined input', () => {
      expect(extractOrigin(undefined)).toBeNull();
      expect(extractOrigin('')).toBeNull();
      expect(extractOrigin('   ')).toBeNull();
    });

    it('returns null for invalid protocols and malformed strings', () => {
      expect(extractOrigin('javascript:alert(1)')).toBeNull();
      expect(extractOrigin('not-a-valid-url')).toBeNull();
    });
  });

  describe('buildContentSecurityPolicy', () => {
    it('builds strict csp with self when apiUrl is not provided', () => {
      const csp = buildContentSecurityPolicy();

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data: https:");
      expect(csp).toContain("font-src 'self' data:");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("object-src 'none'");
    });

    it('includes api origin in connect-src and form-action when apiUrl is valid', () => {
      const csp = buildContentSecurityPolicy('http://localhost:5000/api');

      expect(csp).toContain("connect-src 'self' http://localhost:5000");
      expect(csp).toContain("form-action 'self' http://localhost:5000");
    });

    it('keeps the production policy exactly as shipped when no api origin is set', () => {
      expect(buildContentSecurityPolicy()).toBe(PRODUCTION_CSP_SAME_ORIGIN);
    });

    it('keeps the production policy exactly as shipped with an api origin', () => {
      expect(buildContentSecurityPolicy('https://api.example.com/v1')).toBe(
        PRODUCTION_CSP_WITH_API,
      );
    });

    it('keeps eval out when development is explicitly off', () => {
      expect(buildContentSecurityPolicy('https://api.example.com/v1', false)).toBe(
        PRODUCTION_CSP_WITH_API,
      );
    });

    it('allows eval in script-src only, and only in development', () => {
      expect(buildContentSecurityPolicy('https://api.example.com/v1', true)).toBe(
        DEVELOPMENT_CSP_WITH_API,
      );
    });
  });

  describe('content security policy by environment', () => {
    const API_URL = 'https://api.example.com/v1';

    const cspOf = (options?: SecurityHeadersOptions): string | undefined =>
      buildSecurityHeaders(options).find((header) => header.key === 'Content-Security-Policy')
        ?.value;

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('allows eval when the caller says development', () => {
      expect(cspOf({ apiUrl: API_URL, isProduction: false, isDevelopment: true })).toBe(
        DEVELOPMENT_CSP_WITH_API,
      );
    });

    it('sends the production policy when the caller says production', () => {
      expect(cspOf({ apiUrl: API_URL, isProduction: true })).toBe(PRODUCTION_CSP_WITH_API);
    });

    it('lets production win when both flags are set', () => {
      expect(cspOf({ apiUrl: API_URL, isProduction: true, isDevelopment: true })).toBe(
        PRODUCTION_CSP_WITH_API,
      );
    });

    it('keeps eval out of an environment that is neither production nor development', () => {
      expect(cspOf({ apiUrl: API_URL, isProduction: false, isDevelopment: false })).toBe(
        PRODUCTION_CSP_WITH_API,
      );
    });

    it('allows eval when NODE_ENV is development', () => {
      vi.stubEnv('NODE_ENV', 'development');

      expect(cspOf({ apiUrl: API_URL })).toBe(DEVELOPMENT_CSP_WITH_API);
    });

    it('sends the production policy when NODE_ENV is production', () => {
      vi.stubEnv('NODE_ENV', 'production');

      expect(cspOf({ apiUrl: API_URL })).toBe(PRODUCTION_CSP_WITH_API);
    });

    it('keeps eval out when NODE_ENV is test', () => {
      vi.stubEnv('NODE_ENV', 'test');

      expect(cspOf({ apiUrl: API_URL })).toBe(PRODUCTION_CSP_WITH_API);
    });
  });

  describe('buildSecurityHeaders', () => {
    it('returns baseline security headers in development mode', () => {
      const headers = buildSecurityHeaders({
        apiUrl: 'http://localhost:5000',
        isProduction: false,
      });

      const headerMap = Object.fromEntries(headers.map((h) => [h.key, h.value]));

      expect(headerMap['Content-Security-Policy']).toBeDefined();
      expect(headerMap['X-Content-Type-Options']).toBe('nosniff');
      expect(headerMap['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headerMap['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
      expect(headerMap['X-Frame-Options']).toBe('DENY');
      expect(headerMap['Strict-Transport-Security']).toBeUndefined();
    });

    it('includes strict-transport-security when isProduction is true', () => {
      const headers = buildSecurityHeaders({
        apiUrl: 'https://api.example.com',
        isProduction: true,
      });

      const headerMap = Object.fromEntries(headers.map((h) => [h.key, h.value]));

      expect(headerMap['Strict-Transport-Security']).toBe(
        'max-age=63072000; includeSubDomains; preload',
      );
    });
  });
});
