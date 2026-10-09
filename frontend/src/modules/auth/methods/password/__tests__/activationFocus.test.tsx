// @vitest-environment jsdom
import { fillActivation, navigation } from './registrationHarness';
import * as React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { FormProvider } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { FormInput, FormPassword, SubmitButton } from '@/components/forms';
import { ActivationForm } from '@/modules/auth/components/ActivationForm';
import { useActivationForm } from '@/modules/auth/hooks/useActivationForm';
import { rememberRegistrationEmail } from '@/modules/auth/store/authSlice';
import {
  makeStore,
  renderForm,
  registerFormTestLifecycle,
  stubNetwork,
  success,
} from '@/tests/serverRejectionHarness';

registerFormTestLifecycle();
beforeEach(() => {
  navigation.search = '';
});

// A real consumer keeps the hook's controls mounted so clearing is observable through DOM values.
function RetainedActivationFields() {
  const { form, onSubmit, formRef } = useActivationForm();
  const t = useTranslations('auth.activate');
  return (
    <FormProvider {...form}>
      <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} data-testid="activate-form">
        <FormInput name="email" label={t('email')} data-testid="activate-email-input" />
        <FormInput name="code" label={t('code')} data-testid="activate-code-input" />
        <FormInput name="name" label={t('name')} data-testid="activate-name-input" />
        <FormPassword name="password" label={t('password')} data-testid="activate-password-input" />
        <FormPassword
          name="confirmPassword"
          label={t('confirmPassword')}
          data-testid="activate-confirm-password-input"
        />
        <SubmitButton testId="activate-submit">{t('submit')}</SubmitButton>
      </form>
    </FormProvider>
  );
}

describe.each([
  'en',
  'ar', // feature:locale-ar
] as const)('activation focus and credential cleanup in %s', (locale) => {
  it('focuses the completed-account heading', async () => {
    stubNetwork(() => success({ requiresTwoFactor: false, mustSignIn: true, user: null }));
    const form = await renderForm(locale, <ActivationForm />);
    fillActivation();
    fireEvent.click(screen.getByRole('button', { name: form.message('auth.activate.submit') }));
    const heading = await screen.findByRole('heading', {
      name: form.message('auth.activate.accountCreated'),
    });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('clears both password controls when no session was issued', async () => {
    stubNetwork(() => success({ requiresTwoFactor: false, mustSignIn: true, user: null }));
    const form = await renderForm(locale, <RetainedActivationFields />);
    fillActivation();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: form.message('auth.activate.submit') }));
    });
    expect
      .soft(screen.getByLabelText(form.message('auth.activate.password')))
      .toHaveProperty('value', '');
    expect
      .soft(screen.getByLabelText(form.message('auth.activate.confirmPassword')))
      .toHaveProperty('value', '');
  });

  it.each([
    ['', 'email'],
    ['layla@example.com', 'code'],
  ])('focuses the first empty required field with remembered email %s', async (email, field) => {
    const store = makeStore();
    if (email) store.dispatch(rememberRegistrationEmail(email));
    const form = await renderForm(locale, <ActivationForm />, store);
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: form.message(`auth.activate.${field}`) }),
    );
  });
});
