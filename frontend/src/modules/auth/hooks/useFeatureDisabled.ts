'use client';

import { useCallback } from 'react';
import { baseApi } from '@/store/api/baseApi';
import { useAppDispatch } from '@/store/hooks';
import { isFeatureDisabled } from '../utils/featureDisabled';

/**
 * Handles a reply that the method is turned off. Returns true when it did, so
 * a caller can stop before showing an error of its own.
 *
 * @param error - Rejected value from a mutation
 */
export type FeatureDisabledHandler = (error: unknown) => boolean;

/**
 * A method that was on when the page loaded can be off by the time a form is
 * submitted. Re-reading the discovery endpoint is what takes the control off
 * the screen; on its own the message would leave a dead button behind.
 */
export function useFeatureDisabledHandler(): FeatureDisabledHandler {
  const dispatch = useAppDispatch();

  return useCallback(
    (error: unknown) => {
      if (!isFeatureDisabled(error)) {
        return false;
      }
      dispatch(baseApi.util.invalidateTags(['AuthMethods']));
      return true;
    },
    [dispatch],
  );
}
