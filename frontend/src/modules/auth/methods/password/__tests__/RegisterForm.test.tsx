// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AppLocale } from '@/i18n/load-messages';
import {
  SERVER_TEXT,
  descriptions,
  refuseWrites,
  renderForm,
  registerFormTestLifecycle,
} from '@/tests/serverRejectionHarness';
import { RegisterForm } from '../RegisterForm';

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  Link: () => null,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const AUTH_METHODS = { methods: { password: true } };

async function submitRegistration(locale: AppLocale) {
  const form = await renderForm(locale, <RegisterForm />);
  const name = screen.getByRole('textbox', { name: form.message('auth.register.name') });
  const email = screen.getByRole('textbox', { name: form.message('auth.register.email') });

  fireEvent.change(name, { target: { value: 'Layla Haddad' } });
  fireEvent.change(email, { target: { value: 'layla@example.com' } });
  fireEvent.change(screen.getByLabelText(form.message('auth.register.password')), {
    target: { value: 'Passw0rdLayla' },
  });
  fireEvent.submit(screen.getByTestId('register-form'));

  return { ...form, name, email };
}

registerFormTestLifecycle();

describe.each([
  'en',
  'ar', // feature:locale-ar
] as const)('RegisterForm refused by the server in %s', (locale) => {
  it('marks and focuses the rejected field and shows the localized general message once', async () => {
    refuseWrites(['email', 'nickname'], AUTH_METHODS);

    const { name, email, fieldMessage, generalMessage, errorToasts } =
      await submitRegistration(locale);

    await waitFor(() => {
      expect(email.getAttribute('aria-invalid')).toBe('true');
    });
    expect(descriptions(email)).toEqual([fieldMessage]);
    expect(name.getAttribute('aria-invalid')).toBe('false');
    // The field takes the focus once the form is enabled again.
    await waitFor(() => {
      expect(document.activeElement).toBe(email);
    });
    expect(screen.getByRole('alert').textContent).toBe(generalMessage);
    expect(errorToasts()).toEqual([generalMessage]);
    expect(document.body.textContent).not.toContain(SERVER_TEXT);
    expect(document.body.textContent).not.toContain('Validation failed');
  });

  it('shows only the general message when the server names no field of the form', async () => {
    refuseWrites(['nickname'], AUTH_METHODS);

    const { name, email, generalMessage } = await submitRegistration(locale);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(generalMessage);
    expect(name.getAttribute('aria-invalid')).toBe('false');
    expect(email.getAttribute('aria-invalid')).toBe('false');
  });
});
