'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { AuthMethodFormProps } from '@/modules/auth/methods/types';
import { useSignInWithPasskeyMutation } from '../api';
import { usePasskeySignIn, usePasskeySupport } from '../hooks';
import { PASSKEY_SUPPORT } from '../types';
import type { AuthenticationResponseJSON } from '../utils/webauthn';
import { PasskeyPrompt } from './PasskeyPrompt';

/**
 * Signing in with a passkey and nothing else.
 *
 * No address is asked for: the browser picks a discoverable credential, and
 * the backend reads the account off the one that signs the challenge. A
 * passkey that verified its owner is through; one that only proved possession
 * lands on the code page like any other sign-in.
 */
export function PasskeySignInButton({ redirect, isOnlyMethod }: AuthMethodFormProps) {
  const t = useTranslations('auth.passkeys');
  const support = usePasskeySupport();
  const [signInWithPasskey] = useSignInWithPasskeyMutation();

  const verify = useCallback(
    (response: AuthenticationResponseJSON) => signInWithPasskey({ response }).unwrap(),
    [signInWithPasskey],
  );

  const { run, isBusy, error } = usePasskeySignIn(verify, redirect);

  if (support === PASSKEY_SUPPORT.UNSUPPORTED) {
    return (
      <p
        className="mx-auto max-w-xs text-center text-sm text-muted-foreground"
        role="status"
        data-testid="passkey-unsupported"
      >
        {t('unsupported')}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-xs">
      {!isOnlyMethod && (
        <p className="mb-3 text-center text-sm text-muted-foreground">{t('description')}</p>
      )}

      <PasskeyPrompt
        label={t('signIn')}
        error={error}
        isBusy={isBusy}
        onRun={run}
        testId="passkey-sign-in"
      />
    </div>
  );
}
