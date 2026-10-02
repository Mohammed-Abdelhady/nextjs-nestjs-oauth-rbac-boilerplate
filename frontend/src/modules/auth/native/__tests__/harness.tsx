import { StrictMode, type ReactElement } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react';
import { NextIntlClientProvider, createTranslator, type AbstractIntlMessages } from 'next-intl';
import { vi } from 'vitest';
import { baseApi } from '@/store/api/baseApi';
import { authApi } from '../../store/authApi';
import { NativeAuthorizePanel } from '../NativeAuthorizePanel';
import authReducer from '../../store/authSlice';
import type { User } from '../../types/auth.types';

export const TEST_TRANSACTION = 'txn-abc123';

export const TEST_USER: User = {
  id: 'user-1',
  email: 'layla@example.com',
  name: 'Layla Haddad',
  role: 'user',
  permissions: [],
};

/** Platform value is never shown; it is part of the contract payload. */
export function transactionPayload(applicationName: string) {
  return {
    applicationName,
    platform: 'ios',
    expiresAt: '2026-10-01T12:05:00.000Z',
    alreadyGranted: false,
  };
}

export function makeStore() {
  return configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
    },
    middleware: (defaults) => defaults().concat(baseApi.middleware),
  });
}

export type TestStore = ReturnType<typeof makeStore>;

/** Seeds the transaction query so a test can control the account separately. */
export async function seedTransaction(store: TestStore): Promise<void> {
  await store.dispatch(
    authApi.util.upsertQueryData(
      'getNativeAuthorizeTransaction',
      TEST_TRANSACTION,
      transactionPayload('Acme Mobile'),
    ),
  );
}

/** Seeds both queries so a test can render the card without any network work. */
export async function seedReady(store: TestStore): Promise<void> {
  await seedTransaction(store);
  await store.dispatch(authApi.util.upsertQueryData('getCurrentUser', undefined, TEST_USER));
}

interface RenderPanelOptions {
  locale: 'en' | 'ar';
  messages: AbstractIntlMessages;
  store: TestStore;
  transaction?: string;
}

export function panelElement({
  locale,
  messages,
  store,
  transaction = TEST_TRANSACTION,
}: RenderPanelOptions): ReactElement {
  return (
    <StrictMode>
      <Provider store={store}>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
          <NativeAuthorizePanel transaction={transaction} />
        </NextIntlClientProvider>
      </Provider>
    </StrictMode>
  );
}

export function renderPanel(options: RenderPanelOptions): ReturnType<typeof render> {
  return render(panelElement(options));
}

/** Expected strings are resolved through the same catalogue the app ships. */
export type MessageFn = (key: string, values?: Record<string, string | number>) => string;

export function translator(locale: 'en' | 'ar', messages: AbstractIntlMessages): MessageFn {
  return createTranslator({
    locale,
    messages,
    namespace: 'auth.nativeAuthorize',
  }) as MessageFn;
}

export function codeTranslator(locale: 'en' | 'ar', messages: AbstractIntlMessages): MessageFn {
  return createTranslator({ locale, messages, namespace: 'errors.codes' }) as MessageFn;
}

export type FetchHandler = (request: Request) => Response | Promise<Response>;

export type ProfileMode = 'ok' | 'pending' | 'fail';

export interface FetchOptions {
  /** How the profile endpoint answers; defaults to a signed-in account. */
  profile?: ProfileMode;
}

const PROFILE_PATH = '/api/user/profile';

/**
 * Stubs the network boundary and records the path each request asked for.
 * The profile endpoint is answered here so every test starts from the same
 * signed-in account unless it says otherwise.
 */
export function installFetch(handler: FetchHandler, options: FetchOptions = {}): string[] {
  const requests: string[] = [];
  vi.stubGlobal('fetch', async (request: Request) => {
    const pathname = new URL(request.url).pathname;
    requests.push(pathname);

    if (pathname === PROFILE_PATH) {
      if (options.profile === 'pending') {
        return new Promise<Response>(() => {});
      }
      if (options.profile === 'fail') {
        return jsonResponse(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'profile failed' } },
          500,
        );
      }
      return jsonResponse({ success: true, data: TEST_USER });
    }

    return handler(request);
  });
  return requests;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
