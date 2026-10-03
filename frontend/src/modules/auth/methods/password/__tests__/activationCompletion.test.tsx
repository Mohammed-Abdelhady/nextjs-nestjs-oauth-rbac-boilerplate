// @vitest-environment jsdom
import { fillActivation, navigation } from './registrationHarness';
import * as React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { ErrorCode } from '@app/core';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ActivationGuard } from '@/components/providers/ActivationGuard';
import { ActivationForm } from '@/modules/auth/components/ActivationForm';
import {
  registerFormTestLifecycle,
  renderForm,
  refusalWith,
  stubNetwork,
  success,
} from '@/tests/serverRejectionHarness';

registerFormTestLifecycle();
beforeEach(() => {
  navigation.search = 'redirect=%2Fauth%2Fnative%2Fauthorize%3Ftransaction%3Dtxn-1';
});

const OUTCOMES = [
  { kind: 'signin', response: { requiresTwoFactor: false, mustSignIn: true, user: null } },
  { kind: 'challenge', response: { requiresTwoFactor: true, mustSignIn: false, user: null } },
] as const;

describe.each([
  'en',
  'ar', // feature:locale-ar
] as const)('activation completion on the real guarded page in %s', (locale) => {
  it.each(OUTCOMES)(
    'keeps a $kind outcome without refetching a session that was not issued',
    async ({ kind, response }) => {
      let profileRead = false;
      let release: (response: Response) => void = () => undefined;
      const unexpectedProfile = new Promise<Response>((resolve) => {
        release = resolve;
      });
      const requests = stubNetwork((_, path) => {
        if (path === '/api/user/profile') {
          if (profileRead) return unexpectedProfile;
          profileRead = true;
          return refusalWith(401, ErrorCode.SESSION_REQUIRED);
        }
        if (path === '/api/auth/activate') return success(response);
        throw new Error(`Unexpected request: ${path}`);
      });
      const form = await renderForm(
        locale,
        <AuthProvider>
          <ActivationGuard>
            <ActivationForm />
          </ActivationGuard>
        </AuthProvider>,
      );
      try {
        await screen.findByTestId('activate-code-input');
        fillActivation();
        await act(async () => {
          fireEvent.submit(screen.getByTestId('activate-form'));
        });
        if (kind === 'signin') {
          expect
            .soft(screen.queryByRole('status')?.textContent)
            .toBe(form.message('auth.activate.signInRequired'));
          expect
            .soft(
              screen
                .queryByRole('link', {
                  name: form.message('auth.activate.signIn'),
                })
                ?.getAttribute('href'),
            )
            .toBe('/auth/login?redirect=%2Fauth%2Fnative%2Fauthorize%3Ftransaction%3Dtxn-1');
        } else {
          await waitFor(() =>
            expect(navigation.push).toHaveBeenCalledWith(
              '/auth/2fa?redirect=%2Fauth%2Fnative%2Fauthorize%3Ftransaction%3Dtxn-1',
            ),
          );
        }
        expect.soft(requests).toEqual(['GET /api/user/profile', 'POST /api/auth/activate']);
        expect.soft(navigation.replace).not.toHaveBeenCalled();
      } finally {
        release(refusalWith(401, ErrorCode.SESSION_REQUIRED));
      }
    },
  );
});
