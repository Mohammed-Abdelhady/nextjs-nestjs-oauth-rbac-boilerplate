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
import { EditUserDialog } from '../EditUserDialog';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

async function submitEdit(locale: AppLocale) {
  const form = await renderForm(
    locale,
    <EditUserDialog
      userId="user-1"
      currentName="Layla Haddad"
      currentEmail="layla@example.com"
      open
      onOpenChange={vi.fn()}
    />,
  );
  const name = screen.getByRole('textbox', { name: form.message('users.editUser.name') });
  const email = screen.getByRole('textbox', { name: form.message('users.editUser.email') });

  fireEvent.change(email, { target: { value: 'layla.haddad@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: form.message('users.editUser.save') }));

  return { ...form, name, email };
}

registerFormTestLifecycle();

describe.each([
  'en',
  'ar', // feature:locale-ar
] as const)('EditUserDialog refused by the server in %s', (locale) => {
  it('marks and focuses the rejected field and raises one localized toast', async () => {
    refuseWrites(['email', 'nickname']);

    const { name, email, fieldMessage, generalMessage, errorToasts } = await submitEdit(locale);

    await waitFor(() => {
      expect(email.getAttribute('aria-invalid')).toBe('true');
    });
    expect(descriptions(email)).toEqual([fieldMessage]);
    expect(name.getAttribute('aria-invalid')).toBe('false');
    expect(descriptions(name)).toEqual([]);
    // The fields stay disabled until the store reports the end of the request.
    await waitFor(() => {
      expect(document.activeElement).toBe(email);
    });
    expect(errorToasts()).toEqual([generalMessage]);
    expect(document.body.textContent).not.toContain(SERVER_TEXT);
  });

  it('gives two dialogs on one page their own controls', async () => {
    const { message } = await renderForm(
      locale,
      <>
        <EditUserDialog
          userId="user-1"
          currentName="Layla Haddad"
          currentEmail="layla@example.com"
          open
          onOpenChange={vi.fn()}
        />
        <EditUserDialog
          userId="user-2"
          currentName="Omar Nasser"
          currentEmail="omar@example.com"
          open
          onOpenChange={vi.fn()}
        />
      </>,
    );

    const names = screen.getAllByRole('textbox', {
      name: message('users.editUser.name'),
      hidden: true,
    });

    expect(names.map((field) => field.getAttribute('value'))).toEqual([
      'Layla Haddad',
      'Omar Nasser',
    ]);
    expect(new Set(names.map((field) => field.id)).size).toBe(2);
  });
});
