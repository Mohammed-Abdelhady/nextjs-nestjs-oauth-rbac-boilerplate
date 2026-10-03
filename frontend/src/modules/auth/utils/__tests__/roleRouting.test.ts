import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRoleDashboard } from '../roleRouting';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getRoleDashboard', () => {
  it.each([
    ['admin', '/admin/dashboard'],
    ['manager', '/manager/dashboard'],
    ['support', '/support/dashboard'],
    ['user', '/dashboard'],
  ])('sends %s to its dashboard', (role, path) => {
    expect(getRoleDashboard(role)).toBe(path);
  });

  it.each(['auditor', '', 'Admin', 'constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'sends the unknown role %j to the default dashboard',
    (role) => {
      expect(getRoleDashboard(role)).toBe('/dashboard');
    },
  );
});
