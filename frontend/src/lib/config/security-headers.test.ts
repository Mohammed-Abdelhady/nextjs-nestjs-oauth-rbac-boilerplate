import { describe, expect, it } from 'vitest';
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  extractOrigin,
} from './security-headers';

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
