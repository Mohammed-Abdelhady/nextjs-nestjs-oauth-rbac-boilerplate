import type { ClockPort } from '@app/native-auth';
import { createMonotonicReader } from '../logic/monotonic';
import type { ClockApi } from '../types/modules';

/**
 * `performance.now()` is expected to stop while the device sleeps, so a token
 * can look valid for longer than it is. The server's 401 then leads to a refresh.
 */
export function createClockPort(clock: ClockApi): ClockPort {
  const monotonicTime = createMonotonicReader(() => clock.performance.now());
  return {
    wallTime: () => clock.date.now(),
    monotonicTime,
  };
}
