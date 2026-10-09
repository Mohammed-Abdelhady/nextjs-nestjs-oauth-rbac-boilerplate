// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { loadMessages } from '@/i18n/load-messages';
import { baseApi } from '@/store/api/baseApi';
import { clearBrowserProof, rememberBrowserProof } from '@/store/api/browser-proof';
import authReducer from '@/modules/auth/store/authSlice';
import type { SignedInUser } from '@/modules/auth/types/auth.types';
import { MagicLinkRequestForm } from '../MagicLinkRequestForm';
import { MagicLinkVerifyPanel } from '../MagicLinkVerifyPanel';

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  Link: () => null,
}));

/** Hand-written continuation the server is expected to store and echo back. */
const NATIVE_ROUTE = '/auth/native/authorize?transaction=txn-abc123';

const USER: SignedInUser = {
  id: 'user-1',
  email: 'layla@example.com',
  name: 'Layla Haddad',
  role: 'user',
  permissions: [],
};

let messages: AbstractIntlMessages;

beforeAll(async () => {
  messages = await loadMessages('en');
});

beforeEach(() => {
  replaceMock.mockClear();
  rememberBrowserProof('session-proof', 'session');
});

afterEach(() => {
  cleanup();
  clearBrowserProof();
  vi.unstubAllGlobals();
});

function makeStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer, auth: authReducer },
    middleware: (defaults) => defaults().concat(baseApi.middleware),
  });
}

function renderWithIntl(node: ReactElement, store: ReturnType<typeof makeStore>) {
  return render(
    <Provider store={store}>
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        {node}
      </NextIntlClientProvider>
    </Provider>,
  );
}

describe('magic link continuation', () => {
  async function submitRequest(redirect: string | null): Promise<unknown> {
    let body: unknown;
    vi.stubGlobal('fetch', async (request: Request) => {
      if (request.method === 'POST') {
        body = await request.json();
      }
      return Response.json({ success: true, data: { email: 'layla@example.com' } });
    });

    renderWithIntl(<MagicLinkRequestForm redirect={redirect} isOnlyMethod={false} />, makeStore());

    fireEvent.change(screen.getByTestId('magic-link-email-input'), {
      target: { value: 'layla@example.com' },
    });
    fireEvent.submit(screen.getByTestId('magic-link-form'));

    await waitFor(() => {
      expect(body).toBeDefined();
    });
    return body;
  }

  it('sends the validated native continuation with a magic link request', async () => {
    expect(await submitRequest(NATIVE_ROUTE)).toEqual({
      email: 'layla@example.com',
      redirect: NATIVE_ROUTE,
    });
  });

  it('normalises a locale prefix before sending the continuation', async () => {
    expect(await submitRequest(`/en${NATIVE_ROUTE}`)).toEqual({
      email: 'layla@example.com',
      redirect: NATIVE_ROUTE,
    });
  });

  it.each([
    ['an ordinary path', '/dashboard'],
    ['an off-site address', 'https://evil.com/steal'],
    ['a native route without a transaction', '/auth/native/authorize'],
  ])('omits %s', async (_label, redirect) => {
    expect(await submitRequest(redirect)).toEqual({ email: 'layla@example.com' });
  });

  it('omits the redirect when none was requested', async () => {
    expect(await submitRequest(null)).toEqual({ email: 'layla@example.com' });
  });

  it('follows the continuation the verify step returns', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json({
        success: true,
        data: { requiresTwoFactor: false, user: USER, redirect: NATIVE_ROUTE },
      }),
    );

    renderWithIntl(<MagicLinkVerifyPanel token="link-token" redirect={null} />, makeStore());

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(NATIVE_ROUTE);
    });
  });

  it('rejects an off-site continuation returned by the verify step', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json({
        success: true,
        data: { requiresTwoFactor: false, user: USER, redirect: 'https://evil.com/steal' },
      }),
    );

    renderWithIntl(<MagicLinkVerifyPanel token="link-token" redirect={null} />, makeStore());

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    });
  });
});
