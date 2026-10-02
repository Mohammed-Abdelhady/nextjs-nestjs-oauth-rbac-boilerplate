import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { LocalizedToastMessage } from './LocalizedToastMessage';
import { errorInterceptor } from '@/store/middleware/errorInterceptor';
import { toast } from '@/lib/toast';
import { ErrorCode } from '@app/core';
import { loadMessages, type AppLocale } from '@/i18n/load-messages';
import { lookupMessage } from '@/i18n/__tests__/message-tree';

vi.mock('@/lib/toast', () => ({ toast: { show: vi.fn() } }));

function render(locale: string, messageKey: string, error: Record<string, string>) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={{ toast: { error } }} timeZone="UTC">
      <LocalizedToastMessage messageKey={messageKey} />
    </NextIntlClientProvider>,
  );
}

function runInterceptorForSessionLimit(): ReactElement<{ messageKey: string }> {
  const action = {
    type: 'api/executeQuery/rejected',
    payload: {
      status: 409,
      data: {
        success: false,
        error: { code: ErrorCode.SESSION_LIMIT_REACHED, message: 'Backend message' },
      },
    },
    meta: {
      requestId: 'fixture',
      requestStatus: 'rejected',
      rejectedWithValue: true,
      arg: { endpointName: 'getCurrentUser' },
    },
  };
  const next = vi.fn();
  errorInterceptor({ dispatch: vi.fn(), getState: () => ({}) })(next)(action);
  const message = vi.mocked(toast.show).mock.calls[0][1];
  if (!isValidElement<{ messageKey: string }>(message)) {
    throw new Error('Expected a localized toast message');
  }
  return message;
}

afterEach(() => vi.clearAllMocks());

describe('generated toast fallback messages', () => {
  it.each([
    ['en', 'Check your connection', 'An unexpected error occurred'],
    ['ar', 'تحقق من اتصالك', 'حدث خطأ غير متوقع'],
  ])(
    'renders known and missing keys in %s without exposing a key',
    (locale, networkError, unknownError) => {
      expect(render(locale, 'toast.error.networkError', { networkError, unknownError })).toBe(
        networkError,
      );
      expect(render(locale, 'toast.error.missing', { unknownError })).toBe(unknownError);
      expect(render(locale, 'toast.error.missing', {})).toBe(unknownError);
    },
  );
});

describe('error-code toast handoff', () => {
  it.each(['en', 'ar'] as const)(
    'renders the interceptor output for SESSION_LIMIT_REACHED through the %s catalogue',
    async (locale: AppLocale) => {
      const element = runInterceptorForSessionLimit();
      expect(element.props.messageKey).toBe('errors.codes.SESSION_LIMIT_REACHED');

      const messages = await loadMessages(locale);
      const expected = lookupMessage(messages, element.props.messageKey);
      expect(expected.trim().length).toBeGreaterThan(0);

      const rendered = renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
          {element}
        </NextIntlClientProvider>,
      );
      expect(rendered).toBe(expected);
    },
  );
});
