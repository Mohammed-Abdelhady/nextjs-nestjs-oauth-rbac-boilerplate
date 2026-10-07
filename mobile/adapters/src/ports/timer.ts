import type { TimerPort } from '@app/native-auth';
import type { TimerApi } from '../types/modules';

export function createTimerPort<THandle>(timers: TimerApi<THandle>): TimerPort {
  return {
    after(milliseconds, callback) {
      const handle = timers.setTimeout(callback, milliseconds);
      return () => timers.clearTimeout(handle);
    },
  };
}
