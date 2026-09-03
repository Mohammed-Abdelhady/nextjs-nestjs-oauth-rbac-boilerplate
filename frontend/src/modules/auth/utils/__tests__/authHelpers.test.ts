import { describe, expect, it } from 'vitest';
import { getRedirectPath } from '../authHelpers';

describe('getRedirectPath', () => {
  it('rejects external absolute URLs', () => {
    expect(getRedirectPath('https://evil.com')).toBe('/dashboard');
  });

  it('rejects protocol-relative URLs', () => {
    expect(getRedirectPath('//evil.com')).toBe('/dashboard');
  });

  it('rejects backslash protocol-relative URLs', () => {
    expect(getRedirectPath('/\\evil.com')).toBe('/dashboard');
  });

  it('rejects javascript schemes', () => {
    expect(getRedirectPath('javascript:alert(1)')).toBe('/dashboard');
  });

  it('preserves valid relative paths with query parameters', () => {
    expect(getRedirectPath('/dashboard?x=1')).toBe('/dashboard?x=1');
  });

  it('rejects auth pages and falls back to dashboard', () => {
    expect(getRedirectPath('/auth/login')).toBe('/dashboard');
  });

  it('allows plain valid relative paths', () => {
    expect(getRedirectPath('/settings')).toBe('/settings');
    expect(getRedirectPath('/admin/users')).toBe('/admin/users');
  });

  it('returns custom default path when candidate is invalid', () => {
    expect(getRedirectPath('https://evil.com', '/custom-dashboard')).toBe('/custom-dashboard');
    expect(getRedirectPath('/auth/login', '/admin/dashboard')).toBe('/admin/dashboard');
  });

  it('handles empty, null, or undefined input', () => {
    expect(getRedirectPath('')).toBe('/dashboard');
    expect(getRedirectPath(null)).toBe('/dashboard');
    expect(getRedirectPath(undefined)).toBe('/dashboard');
  });
});
