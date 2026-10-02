import { ErrorCode, parseApiError } from '@app/core';

/**
 * True when a call failed because this deployment turned the method off.
 * The control that raised it should disappear rather than offer a retry.
 */
export function isFeatureDisabled(error: unknown): boolean {
  return parseApiError(error).code === ErrorCode.FEATURE_DISABLED;
}
