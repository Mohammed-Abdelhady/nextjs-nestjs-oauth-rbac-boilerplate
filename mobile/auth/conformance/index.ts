import { AUTH_BROWSER_CHECKS } from './auth-browser';
import { CALLBACKS_CHECKS } from './callbacks';
import { CREDENTIALS_CHECKS } from './credentials';
import { CRYPTO_CHECKS } from './crypto';
import { describeValue } from './expect';
import { INSTALL_CHECKS } from './install';
import { CLOCK_CHECKS, TIMER_CHECKS } from './time';
import type { ConformanceCheck, ConformanceResult, ConformanceSubject } from './types';

export { CHECK_ID } from './constants';
export { ConformanceFailure } from './expect';
export type * from './types';

export const CONFORMANCE_CHECKS: readonly ConformanceCheck[] = [
  ...CREDENTIALS_CHECKS,
  ...AUTH_BROWSER_CHECKS,
  ...CRYPTO_CHECKS,
  ...CALLBACKS_CHECKS,
  ...CLOCK_CHECKS,
  ...TIMER_CHECKS,
  ...INSTALL_CHECKS,
];

async function runCheck(
  check: ConformanceCheck,
  subject: ConformanceSubject,
): Promise<ConformanceResult> {
  try {
    await subject.driver.reset();
    await check.run(subject);
    return { id: check.id, port: check.port, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : describeValue(error);
    return { id: check.id, port: check.port, ok: false, message };
  }
}

/** Runs every port check against one shell's adapters, one check at a time. */
export async function runConformance(subject: ConformanceSubject): Promise<ConformanceResult[]> {
  const results: ConformanceResult[] = [];
  for (const check of CONFORMANCE_CHECKS) results.push(await runCheck(check, subject));
  return results;
}
