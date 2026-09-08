'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorCode } from '@/constants/errorCodes';
import { toast } from '@/lib/toast';
import { baseApi } from '@/store/api/baseApi';
import { useAppDispatch } from '@/store/hooks';
import { isFeatureDisabled } from '../utils/featureDisabled';

/**
 * Handles a reply that the method is turned off. Returns true when it did, so
 * a caller can stop before showing an error of its own.
 *
 * @param error - Rejected value from a mutation
 * @param notify - Whether to raise the toast. Pass false where the screen
 * already shows the message inline.
 */
export type FeatureDisabledHandler = (error: unknown, notify?: boolean) => boolean;

/**
 * A method that was on when the page loaded can be off by the time a form is
 * submitted. Re-reading the discovery endpoint is what takes the control off
 * the screen; on its own the message would leave a dead button behind.
 */
export function useFeatureDisabledHandler(): FeatureDisabledHandler {
  const dispatch = useAppDispatch();
  const tCodes = useTranslations('errors.codes');

  return useCallback(
    (error: unknown, notify = true) => {
      if (!isFeatureDisabled(error)) {
        return false;
      }
      if (notify) {
        toast.error(tCodes(ErrorCode.FEATURE_DISABLED));
      }
      dispatch(baseApi.util.invalidateTags(['AuthMethods']));
      return true;
    },
    [dispatch, tCodes],
  );
}
