import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { LocalizedToastMessage } from './LocalizedToastMessage';

function render(locale: string, messageKey: string, error: Record<string, string>) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={{ toast: { error } }} timeZone="UTC">
      <LocalizedToastMessage messageKey={messageKey} />
    </NextIntlClientProvider>,
  );
}

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
