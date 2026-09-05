'use client';

import { useGetAuthMethodsQuery } from '../api/authMethodsApi';
import type { AuthMethods } from '../types/auth.types';

/** What a screen knows about the sign-in methods before it renders. */
export interface AuthMethodsState {
  methods: AuthMethods | undefined;
  isLoading: boolean;
  isError: boolean;
  /** True once the answer is in and every method is off. */
  hasNoMethods: boolean;
}

const NOTHING_ENABLED: AuthMethods = {
  password: false,
  magicLink: false,
  twoFactor: false,
  passkeys: false,
  oauth: [],
};

function countsAsEnabled(methods: AuthMethods): boolean {
  return methods.password || methods.magicLink || methods.passkeys || methods.oauth.length > 0;
}

/**
 * Reads the enabled sign-in methods. A failed request falls back to nothing
 * enabled, so a screen shows the notice instead of a form that cannot work.
 */
export function useAuthMethods(): AuthMethodsState {
  const { data, isLoading, isError } = useGetAuthMethodsQuery();
  const methods = isError ? NOTHING_ENABLED : data;

  return {
    methods,
    isLoading,
    isError,
    hasNoMethods: !isLoading && methods !== undefined && !countsAsEnabled(methods),
  };
}
