'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorCode } from '@/constants/errorCodes';
import { useRouter } from '@/i18n/navigation';
import { useAppDispatch } from '@/store/hooks';
import { REDIRECT_PARAM } from '../constants/authMethods';
import { nativeAuthorizeContinuation } from '../constants/nativeAuthorize';
import { translatableErrorCode } from '../utils/errorCodeMessage';
import {
  useApproveNativeAuthorizeMutation,
  useDenyNativeAuthorizeMutation,
  useGetCurrentUserQuery,
  useGetNativeAuthorizeTransactionQuery,
  useLogoutMutation,
} from '../store/authApi';
import { logout as logoutAction } from '../store/authSlice';
import { isSafeNativeRedirect } from './nativeRedirect';

/** How long the page waits for the app to open before offering a second try. */
const REOPEN_DELAY_MS = 2000;

/** Which control is running, so each one can show its own progress. */
export type NativeAuthorizeAction = 'approve' | 'deny' | 'notYou';

export type NativeAuthorizeViewKind =
  'loading' | 'ready' | 'returning' | 'expired' | 'disabled' | 'error';

export interface NativeAuthorizeFailure {
  code: string;
  message: string;
}

export interface NativeAuthorizeView {
  kind: NativeAuthorizeViewKind;
  applicationName: string;
  accountName: string;
  accountEmail: string;
  action: NativeAuthorizeAction | null;
  failure: NativeAuthorizeFailure | null;
  canReopen: boolean;
}

export interface NativeAuthorizeController {
  view: NativeAuthorizeView;
  approve: () => void;
  deny: () => void;
  notYou: () => void;
  retry: () => void;
  reopen: () => void;
}

/** Where a signed-out visitor goes, with the way back carried along. */
function signInHref(transaction: string): string {
  const continuation = nativeAuthorizeContinuation(transaction);
  return `/auth/login?${REDIRECT_PARAM}=${encodeURIComponent(continuation)}`;
}

const EMPTY_VIEW: Omit<NativeAuthorizeView, 'kind'> = {
  applicationName: '',
  accountName: '',
  accountEmail: '',
  action: null,
  failure: null,
  canReopen: false,
};

/**
 * The browser step of native sign-in, as state plus handlers.
 *
 * It waits for the account as well as the transaction, so approval is never
 * offered before the person can see which account is granting it. A single
 * in-flight guard covers approve, deny and "Not you?", so no two requests can
 * race and a held Enter spends the transaction once.
 */
export function useNativeAuthorize(transaction: string): NativeAuthorizeController {
  const t = useTranslations('auth.nativeAuthorize');
  const tCodes = useTranslations('errors.codes');
  const router = useRouter();
  const dispatch = useAppDispatch();

  const {
    data: account,
    isError: isAccountError,
    error: accountError,
  } = useGetCurrentUserQuery(undefined);
  const {
    data: transactionData,
    isLoading: isTransactionLoading,
    isError: isTransactionError,
    error: transactionError,
    refetch,
  } = useGetNativeAuthorizeTransactionQuery(transaction, {
    skip: transaction.length === 0,
  });
  const [approve] = useApproveNativeAuthorizeMutation();
  const [deny] = useDenyNativeAuthorizeMutation();
  const [logout] = useLogoutMutation();

  const [action, setAction] = useState<NativeAuthorizeAction | null>(null);
  const [actionFailure, setActionFailure] = useState<NativeAuthorizeFailure | null>(null);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [canReopen, setCanReopen] = useState(false);

  const inFlight = useRef(false);
  const hasRedirected = useRef(false);

  const toFailure = useCallback(
    (error: unknown): NativeAuthorizeFailure => {
      const code = translatableErrorCode(error, ErrorCode.INTERNAL_ERROR);
      return { code, message: tCodes(code) };
    },
    [tCodes],
  );

  const transactionFailure = isTransactionError ? toFailure(transactionError) : null;
  const accountFailure = isAccountError ? toFailure(accountError) : null;
  const failure = actionFailure ?? transactionFailure ?? accountFailure;
  const sessionRequired = failure?.code === ErrorCode.SESSION_REQUIRED;

  // A 401 must clear the auth slice too, or the sign-in page bounces straight
  // back to this route and the loop repeats.
  useEffect(() => {
    if (!sessionRequired || hasRedirected.current) {
      return;
    }
    hasRedirected.current = true;
    dispatch(logoutAction());
    router.replace(signInHref(transaction));
  }, [dispatch, router, sessionRequired, transaction]);

  useEffect(() => {
    if (!returning) {
      return;
    }
    const timer = setTimeout(() => setCanReopen(true), REOPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [returning]);

  const runAction = useCallback(
    async (kind: 'approve' | 'deny') => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      setActionFailure(null);
      setAction(kind);
      try {
        const call = kind === 'approve' ? approve : deny;
        const result = await call({ transactionId: transaction }).unwrap();
        if (!isSafeNativeRedirect(result.redirectUri)) {
          inFlight.current = false;
          setAction(null);
          setActionFailure({ code: ErrorCode.INTERNAL_ERROR, message: t('errorGeneric') });
          return;
        }
        setRedirectUri(result.redirectUri);
        setAction(null);
        setCanReopen(false);
        setReturning(true);
        window.location.assign(result.redirectUri);
      } catch (error) {
        inFlight.current = false;
        setAction(null);
        setActionFailure(toFailure(error));
      }
    },
    [approve, deny, t, toFailure, transaction],
  );

  const notYou = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setActionFailure(null);
    setAction('notYou');
    try {
      await logout().unwrap();
      dispatch(logoutAction());
      router.replace(signInHref(transaction));
    } catch (error) {
      inFlight.current = false;
      setAction(null);
      setActionFailure(toFailure(error));
    }
  }, [dispatch, logout, router, toFailure, transaction]);

  const retry = useCallback(() => {
    inFlight.current = false;
    setActionFailure(null);
    setAction(null);
    setReturning(false);
    setCanReopen(false);
    refetch();
  }, [refetch]);

  const reopen = useCallback(() => {
    if (redirectUri) {
      window.location.assign(redirectUri);
    }
  }, [redirectUri]);

  const approveAction = useCallback(() => {
    void runAction('approve');
  }, [runAction]);
  const denyAction = useCallback(() => {
    void runAction('deny');
  }, [runAction]);

  const view: NativeAuthorizeView = (() => {
    const base = {
      ...EMPTY_VIEW,
      applicationName: transactionData?.applicationName ?? '',
      accountName: account?.name ?? '',
      accountEmail: account?.email ?? '',
      action,
      failure,
      canReopen,
    };

    if (transaction.length === 0 || failure?.code === ErrorCode.NATIVE_TRANSACTION_EXPIRED) {
      return { ...base, kind: 'expired' };
    }
    if (sessionRequired) {
      return { ...base, kind: 'loading' };
    }
    if (failure?.code === ErrorCode.NATIVE_AUTH_DISABLED) {
      return { ...base, kind: 'disabled' };
    }
    if (failure) {
      return { ...base, kind: 'error' };
    }
    if (returning) {
      return { ...base, kind: 'returning' };
    }
    if (!account || isTransactionLoading || !transactionData) {
      return { ...base, kind: 'loading' };
    }
    return { ...base, kind: 'ready' };
  })();

  return { view, approve: approveAction, deny: denyAction, notYou, retry, reopen };
}
