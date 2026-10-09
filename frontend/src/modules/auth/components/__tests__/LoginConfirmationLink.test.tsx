// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import {
  renderForm,
  registerFormTestLifecycle,
  stubNetwork,
  success,
} from '@/tests/serverRejectionHarness';
import { LoginForm } from '../LoginForm';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
registerFormTestLifecycle();

const CONFIGURATIONS = [
  [false, false, false, false],
  [false, false, false, true],
  [false, false, true, false],
  [false, false, true, true],
  [false, true, false, false],
  [false, true, false, true],
  [false, true, true, false],
  [false, true, true, true],
  [true, false, false, false],
  [true, false, false, true],
  [true, false, true, false],
  [true, false, true, true],
  [true, true, false, false],
  [true, true, false, true],
  [true, true, true, false],
  [true, true, true, true],
] as const;

describe.each([
  'en',
  'ar', // feature:locale-ar
] as const)('new-address confirmation entry in %s', (locale) => {
  it.each(CONFIGURATIONS)(
    'is available with password=%s, magicLink=%s, passkeys=%s, OAuth=%s',
    async (password, magicLink, passkeys, hasOAuth) => {
      const methods = {
        password,
        magicLink,
        passkeys,
        oauth: hasOAuth ? [{ id: 'google', displayName: 'Google' }] : [],
      };
      stubNetwork((_, path) =>
        success(path === '/api/auth/methods' ? { methods } : { providers: [] }),
      );
      const form = await renderForm(locale, <LoginForm />);
      // Settle the real methods request before checking the final composition.
      await act(async () => undefined);
      const link = screen.getByRole('link', { name: form.message('auth.login.confirmNewEmail') });
      expect(link.getAttribute('href')).toBe('/auth/confirm-email-change');
    },
  );
});
