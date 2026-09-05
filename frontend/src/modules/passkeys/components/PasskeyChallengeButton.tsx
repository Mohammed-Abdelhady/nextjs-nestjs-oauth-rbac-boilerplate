'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthMethods } from '@/modules/auth/hooks/useAuthMethods';
import { useAnswerTwoFactorWithPasskeyMutation } from '../api';
import { usePasskeySignIn, usePasskeySupport } from '../hooks';
import { PASSKEY_SUPPORT } from '../types';
import type { AuthenticationResponseJSON } from '../utils/webauthn';
import { PasskeyPrompt } from './PasskeyPrompt';

interface PasskeyChallengeButtonProps {
  redirect: string | null;
}

/**
 * Answering a held sign-in with a passkey instead of a code.
 *
 * The backend does not say whether this account has one, because the challenge
 * page has no session and naming what an address holds would leak it. So the
 * option shows wherever passkeys are on, and an account without one gets the
 * browser's own "no passkey here" prompt.
 */
export function PasskeyChallengeButton({ redirect }: PasskeyChallengeButtonProps) {
  const t = useTranslations('auth.passkeys');
  const { methods } = useAuthMethods();
  const support = usePasskeySupport();
  const [answerWithPasskey] = useAnswerTwoFactorWithPasskeyMutation();

  const verify = useCallback(
    (response: AuthenticationResponseJSON) =>
      answerWithPasskey({ passkeyResponse: response }).unwrap(),
    [answerWithPasskey],
  );

  const { run, isBusy, error } = usePasskeySignIn(verify, redirect);

  if (methods?.passkeys !== true || support === PASSKEY_SUPPORT.UNSUPPORTED) {
    return null;
  }

  return (
    <PasskeyPrompt
      label={t('useInstead')}
      error={error}
      isBusy={isBusy}
      onRun={run}
      variant="outline"
      className="mt-6 w-full"
      testId="passkey-two-factor"
    />
  );
}
