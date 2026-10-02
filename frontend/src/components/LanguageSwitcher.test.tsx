// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher } from './LanguageSwitcher';

const state = vi.hoisted(() => ({ locales: ['en'] as string[] }));

vi.mock('@/i18n/routing', () => ({
  routing: {
    get locales() {
      return state.locales;
    },
    defaultLocale: 'en',
  },
}));

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/en',
  useRouter: () => ({ replace: vi.fn() }),
}));

const MESSAGES = {
  common: {
    switchToEnglish: 'English',
    switchToArabic: 'Arabic', // feature:locale-ar
  },
};

function renderSwitcher(): void {
  render(
    <NextIntlClientProvider locale="en" messages={MESSAGES} timeZone="UTC">
      <LanguageSwitcher />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  state.locales = ['en'];
});

describe('LanguageSwitcher', () => {
  it('renders no button when the router serves only one locale', () => {
    state.locales = ['en'];

    renderSwitcher();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  // feature:locale-ar:start
  it('renders one button for each routed locale', () => {
    state.locales = ['en', 'ar'];

    renderSwitcher();

    expect(screen.queryAllByRole('button')).toHaveLength(2);
  });
  // feature:locale-ar:end
});
