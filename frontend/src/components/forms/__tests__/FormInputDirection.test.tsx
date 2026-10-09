// @vitest-environment jsdom
import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderForm, registerFormTestLifecycle } from '@/tests/serverRejectionHarness';
import { FormInput } from '../FormInput';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
registerFormTestLifecycle();

function InputFields({ direction }: { direction: 'ltr' | 'rtl' }) {
  const form = useForm({ defaultValues: { email: '', code: '', name: '' } });
  const t = useTranslations('auth.activate');
  return (
    <div dir={direction}>
      <FormProvider {...form}>
        <FormInput
          name="email"
          type="email"
          dir="rtl"
          label={t('email')}
          data-testid="direction-email"
        />
        <FormInput
          name="code"
          autoComplete="one-time-code"
          dir="rtl"
          label={t('code')}
          data-testid="direction-code"
        />
        <FormInput name="name" dir={direction} label={t('name')} data-testid="direction-name" />
      </FormProvider>
    </div>
  );
}

describe.each([
  ['en', 'ltr'],
  ['ar', 'rtl'], // feature:locale-ar
] as const)('shared input direction in %s', (locale, direction) => {
  it('keeps addresses and codes left to right and preserves the name direction', async () => {
    const form = await renderForm(locale, <InputFields direction={direction} />);
    expect
      .soft(
        screen
          .getByRole('textbox', { name: form.message('auth.activate.email') })
          .getAttribute('dir'),
      )
      .toBe('ltr');
    expect
      .soft(
        screen
          .getByRole('textbox', { name: form.message('auth.activate.code') })
          .getAttribute('dir'),
      )
      .toBe('ltr');
    expect
      .soft(
        screen
          .getByRole('textbox', { name: form.message('auth.activate.name') })
          .getAttribute('dir'),
      )
      .toBe(direction);
  });
});
