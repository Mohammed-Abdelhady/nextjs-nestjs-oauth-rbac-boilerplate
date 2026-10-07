import type { CredentialReadResult, CredentialWriteResult } from '@app/native-auth';
import { STORE_ERROR_TEXT } from '../constants';

export type StoreCondition = Exclude<CredentialReadResult['kind'], 'found' | 'missing'>;

const RULES: readonly { condition: StoreCondition; fragments: readonly string[] }[] = [
  { condition: 'locked', fragments: [STORE_ERROR_TEXT.IOS_INTERACTION_NOT_ALLOWED] },
  { condition: 'cancelled', fragments: [STORE_ERROR_TEXT.IOS_USER_CANCELED] },
  {
    condition: 'corrupt',
    fragments: [
      STORE_ERROR_TEXT.IOS_DECODE,
      STORE_ERROR_TEXT.ANDROID_UNPARSABLE,
      STORE_ERROR_TEXT.ANDROID_NO_SCHEME,
      STORE_ERROR_TEXT.ANDROID_UNKNOWN_SCHEME,
    ],
  },
];

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : '';
}

/**
 * The module rejects with one error type and puts the cause in the message.
 * Android's plain decrypt failure may be a keystore that is briefly out of
 * reach or an entry that is gone for good, so it stays `unavailable`.
 */
export function storeConditionFromError(error: unknown): StoreCondition {
  const text = errorText(error);
  const rule = RULES.find(({ fragments }) => fragments.some((fragment) => text.includes(fragment)));
  return rule?.condition ?? 'unavailable';
}

export type WriteCondition = Exclude<CredentialWriteResult['kind'], 'done'>;

/** A write has nothing to decode, so a decode failure during one is a store that is out of reach. */
export function writeConditionFromError(error: unknown): WriteCondition {
  const condition = storeConditionFromError(error);
  return condition === 'corrupt' ? 'unavailable' : condition;
}
