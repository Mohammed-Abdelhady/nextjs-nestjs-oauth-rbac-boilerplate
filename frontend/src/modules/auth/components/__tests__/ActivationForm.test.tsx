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
import { ActivationForm } from '../ActivationForm';

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

/** Answers the activate write with the one code the server now sends. */
function rejectActivationCode(): string[] {
  return stubNetwork((request) =>
    request.method === 'POST' ? refusalWith(400, ErrorCode.ACTIVATION_CODE_INVALID) : success({}),
  );
}

async function submitCode(locale: AppLocale) {
  const form = await renderForm(locale, <ActivationForm />);
  // The way out appears only once a code has been rejected.
  expect(screen.queryByTestId('register-again-link')).toBeNull();

  const code = await screen.findByTestId('activate-code-input');
  fireEvent.change(code, { target: { value: '000000' } });
  fireEvent.submit(screen.getByTestId('activate-form'));
  return form;
}

describe.each([
  'en',
  'ar', // feature:locale-ar
] as const)('ActivationForm rejected code in %s', (locale) => {
  it('shows the catalogue message and the register-again link only after a rejection', async () => {
    rejectActivationCode();

    const form = await submitCode(locale);

    await waitFor(() => {
      expect(screen.getByTestId('activate-error').textContent).toBe(
        form.message('errors.codes.ACTIVATION_CODE_INVALID'),
      );
    });
    const registerAgain = screen.getByTestId('register-again-link');
    expect(registerAgain.textContent).toBe(form.message('auth.activate.registerAgain'));
    expect(registerAgain.getAttribute('href')).toBe('/auth/register');
    expect(document.body.textContent).not.toContain(SERVER_TEXT);
  });

  it.each([
    [429, ErrorCode.RATE_LIMIT_EXCEEDED],
    [409, ErrorCode.EMAIL_ALREADY_EXISTS],
  ])('shows a %i rejection its own catalogue message', async (status, code) => {
    stubNetwork((request) => (request.method === 'POST' ? refusalWith(status, code) : success({})));

    const form = await renderForm(locale, <ActivationForm />);
    fireEvent.change(await screen.findByTestId('activate-code-input'), {
      target: { value: '000000' },
    });
    fireEvent.submit(screen.getByTestId('activate-form'));

    await waitFor(() => {
      expect(screen.getByTestId('activate-error').textContent).toBe(
        form.message(`errors.codes.${code}`),
      );
    });
    expect(screen.queryByTestId('register-again-link')).toBeNull();
  });
});
