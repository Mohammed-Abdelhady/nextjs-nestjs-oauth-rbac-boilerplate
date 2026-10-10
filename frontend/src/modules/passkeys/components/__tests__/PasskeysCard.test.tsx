// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AppLocale } from '@/i18n/load-messages';
import {
  descriptions,
  refusalWith,
  registerFormTestLifecycle,
  renderForm,
  stubNetwork,
  success,
} from '@/tests/serverRejectionHarness';
import { PASSKEY_PATHS, passkeyPath } from '../../constants';
import { PasskeysCard } from '../PasskeysCard';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const PASSKEY = {
  id: 'pk-1',
  name: 'Laptop',
  deviceType: 'singleDevice',
  backedUp: false,
  createdAt: '2026-01-05T10:00:00.000Z',
  lastUsedAt: null,
};
const REMOVE = `DELETE ${passkeyPath(PASSKEY.id)}`;

/** A server with passkeys on and one passkey listed, answering as scripted. */
function server(script: { canRemove?: boolean; remove?: () => Response }) {
  return stubNetwork((request, path) => {
    if (request.method === 'DELETE') {
      return script.remove?.() ?? success({ message: 'removed' });
    }
    if (path === PASSKEY_PATHS.LIST) {
      return success({ passkeys: [PASSKEY], canRemove: script.canRemove });
    }
    return success({ methods: { password: true, passkeys: true, oauth: [] } });
  });
}

async function renderCard(locale: AppLocale) {
  const view = await renderForm(locale, <PasskeysCard />);
  const remove = await screen.findByRole('button', {
    name: view.format('settings.passkeys.delete.label', { name: PASSKEY.name }),
  });
  return { ...view, remove };
}

registerFormTestLifecycle();

describe.each([
  'en',
  'ar', // feature:locale-ar
] as const)('PasskeysCard in %s', (locale) => {
  it.each([{ canRemove: true }, { canRemove: undefined }])(
    'offers the removal when the server says $canRemove',
    async ({ canRemove }) => {
      const requests = server({ canRemove });

      const { remove } = await renderCard(locale);

      expect(remove.getAttribute('aria-disabled')).toBeNull();
      expect(descriptions(remove)).toEqual([]);
      fireEvent.click(remove);
      fireEvent.click(await screen.findByTestId('passkey-delete-confirm'));
      await waitFor(() => expect(requests).toContain(REMOVE));
    },
  );

  it('keeps a refused removal in reach and says why, without sending it', async () => {
    const requests = server({ canRemove: false });

    const { remove, message } = await renderCard(locale);

    // Not the native attribute: a disabled button leaves the tab order.
    expect(remove.hasAttribute('disabled')).toBe(false);
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    expect(descriptions(remove)).toEqual([
      message('settings.passkeys.delete.blockedLastSignInMethod'),
    ]);

    fireEvent.click(remove);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(requests.filter((request) => request.startsWith('DELETE'))).toEqual([]);
  });

  it('shows the refusal in the dialog when the server refuses a removal it had allowed', async () => {
    const requests = server({
      canRemove: true,
      remove: () => refusalWith(409, 'PASSKEY_LAST_SIGN_IN_METHOD'),
    });

    const { remove, message, successToasts } = await renderCard(locale);
    fireEvent.click(remove);
    fireEvent.click(await screen.findByTestId('passkey-delete-confirm'));

    const refusal = await screen.findByTestId('passkey-delete-error');
    expect(refusal.textContent).toBe(message('errors.codes.PASSKEY_LAST_SIGN_IN_METHOD'));
    expect(requests).toContain(REMOVE);
    expect(successToasts()).toEqual([]);
    expect(screen.getByTestId(`passkey-row-${PASSKEY.id}`)).toBeTruthy();
  });
});
