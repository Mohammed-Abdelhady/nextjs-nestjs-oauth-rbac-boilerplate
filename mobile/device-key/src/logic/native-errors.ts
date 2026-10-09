import { NATIVE_CONDITION, NATIVE_ERROR_CODE } from '../constants';
import type { NativeCondition } from '../types/device-key';

const CONDITION_BY_CODE: Readonly<Record<string, NativeCondition>> = {
  [NATIVE_ERROR_CODE.UNAVAILABLE]: NATIVE_CONDITION.UNAVAILABLE,
  [NATIVE_ERROR_CODE.NO_HARDWARE]: NATIVE_CONDITION.NO_SECURE_HARDWARE,
  [NATIVE_ERROR_CODE.NOT_FOUND]: NATIVE_CONDITION.NOT_FOUND,
  [NATIVE_ERROR_CODE.INVALIDATED]: NATIVE_CONDITION.INVALIDATED,
};

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

/**
 * An unknown failure stays `unavailable`. That keeps the session, where a wrong
 * guess of `invalidated` would delete a working key.
 */
export function nativeCondition(error: unknown): NativeCondition {
  const code = codeOf(error);
  const known =
    code !== undefined && Object.hasOwn(CONDITION_BY_CODE, code)
      ? CONDITION_BY_CODE[code]
      : undefined;
  return known ?? NATIVE_CONDITION.UNAVAILABLE;
}
