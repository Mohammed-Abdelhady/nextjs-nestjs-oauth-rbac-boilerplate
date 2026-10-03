// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ErrorCode } from '@app/core';
import type { AppLocale } from '@/i18n/load-messages';
import {
  SERVER_TEXT,
  refusalWith,
  registerFormTestLifecycle,
  renderForm,
  stubNetwork,
  success,
} from '@/tests/serverRejectionHarness';
import { ResetPasswordForm } from '../ResetPasswordForm';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('email=layla@example.com'),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('a', props, children),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

registerFormTestLifecycle();

/** Answers the reset write with the one code the server now sends. */
function rejectResetCode(): string[] {
  return stubNetwork((request) =>
    request.method === 'POST'
      ? refusalWith(400, ErrorCode.PASSWORD_RESET_CODE_INVALID)
      : success({}),
  );
}

async function submitReset(locale: AppLocale) {
  const form = await renderForm(locale, <ResetPasswordForm />);
  fireEvent.change(await screen.findByTestId('reset-password-code-input'), {
    target: { value: '000000' },
  });
  fireEvent.change(screen.getByTestId('reset-password-password-input'), {
    target: { value: 'Passw0rdLayla' },
  });
  fireEvent.change(screen.getByTestId('reset-password-confirmPassword-input'), {
    target: { value: 'Passw0rdLayla' },
  });
  fireEvent.submit(screen.getByTestId('reset-password-form'));
  return form;
}

describe.each([
  'en',
  'ar', // feature:locale-ar
] as const)('ResetPasswordForm rejected code in %s', (locale) => {
  it('shows the catalogue generic message and offers a new code, never the server text', async () => {
    rejectResetCode();

    const form = await submitReset(locale);

    await waitFor(() => {
      expect(screen.getByTestId('reset-password-error').textContent).toBe(
        form.message('errors.codes.PASSWORD_RESET_CODE_INVALID'),
      );
    });
    const requestNew = screen.getByTestId('request-new-code-link');
    expect(requestNew.textContent).toBe(form.message('auth.resetPassword.requestNewCode'));
    expect(requestNew.getAttribute('href')).toBe('/auth/forgot-password');
    expect(document.body.textContent).not.toContain(SERVER_TEXT);
  });

  it('shows another translatable code its own catalogue message', async () => {
    stubNetwork((request) =>
      request.method === 'POST'
        ? refusalWith(404, ErrorCode.USER_NOT_FOUND_FOR_RESET)
        : success({}),
    );

    const form = await submitReset(locale);

    await waitFor(() => {
      expect(screen.getByTestId('reset-password-error').textContent).toBe(
        form.message('errors.codes.USER_NOT_FOUND_FOR_RESET'),
      );
    });
    expect(screen.queryByTestId('request-new-code-link')).toBeNull();
  });
});
