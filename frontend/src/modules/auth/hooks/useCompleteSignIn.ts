'use client';

import { useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAppDispatch } from '@/store/hooks';
import { authApi } from '../store/authApi';
import type { User } from '../types/auth.types';
import { signedInPath, twoFactorPath } from '../utils/signInRouting';

export interface SignInOutcome {
  requiresTwoFactor: boolean;
  user: User | null;
}

/** Finishes a sign-in the same way for the password, link and code flows. */
export type CompleteSignIn = (outcome: SignInOutcome, redirect?: string | null) => Promise<void>;

/**
 * The last step of every sign-in the client drives.
 *
 * A challenged account goes to the code page with its redirect intact.
 * Otherwise the session cookie is already set, so the profile is refetched
 * when the reply did not carry the account, and the browser moves on.
 */
export function useCompleteSignIn(): CompleteSignIn {
  const router = useRouter();
  const dispatch = useAppDispatch();

  return useCallback(
    async (outcome: SignInOutcome, redirect?: string | null) => {
      if (outcome.requiresTwoFactor) {
        router.push(twoFactorPath(redirect));
        return;
      }

      const user =
        outcome.user ??
        (await dispatch(
          authApi.endpoints.getCurrentUser.initiate(undefined, { forceRefetch: true }),
        ).unwrap());

      router.replace(signedInPath(user, redirect));
    },
    [dispatch, router],
  );
}
