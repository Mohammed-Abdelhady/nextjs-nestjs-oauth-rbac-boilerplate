import type { AuthBrowserResult } from '@app/native-auth';
import { BROWSER_FAILURE, BROWSER_RESULT_TYPE } from '../constants';
import type { WebBrowserSessionResult } from '../types/modules';

/**
 * iOS answers `cancel` for a person closing the sheet and for a session that
 * could not be presented. Android answers `dismiss` when the person closes the
 * tab, which is the same answer a programmatic dismissal gets on iOS.
 */
export function browserResultToOutcome(result: WebBrowserSessionResult): AuthBrowserResult {
  switch (result.type) {
    case BROWSER_RESULT_TYPE.SUCCESS:
      return typeof result.url === 'string' && result.url.length > 0
        ? { kind: 'redirect', url: result.url }
        : { kind: 'failed', reason: BROWSER_FAILURE.REDIRECT_WITHOUT_ADDRESS };
    case BROWSER_RESULT_TYPE.CANCEL:
      return { kind: 'cancelled' };
    case BROWSER_RESULT_TYPE.DISMISS:
      return { kind: 'dismissed' };
    case BROWSER_RESULT_TYPE.LOCKED:
      return { kind: 'failed', reason: BROWSER_FAILURE.BROWSER_LOCKED };
    default:
      return { kind: 'failed', reason: `${BROWSER_FAILURE.UNEXPECTED_RESULT}:${result.type}` };
  }
}

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' && error.code.length > 0 ? error.code : undefined;
}

/** A rejection carries Expo's error code when it has one, else its message. */
export function browserErrorToOutcome(error: unknown): AuthBrowserResult {
  const message = error instanceof Error ? error.message : '';
  return { kind: 'failed', reason: codeOf(error) ?? (message || BROWSER_FAILURE.UNKNOWN) };
}
