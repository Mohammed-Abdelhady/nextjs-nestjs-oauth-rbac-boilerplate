import type { FakeTimer } from './fake-timer';
import { Deferred } from './support';

interface TimerHooks {
  onSchedule?: (milliseconds: number) => void;
  onCancel?: (milliseconds: number) => void;
}

export function watchTimerDrain(timer: FakeTimer, hooks: TimerHooks = {}): () => Promise<void> {
  let sealed = false;
  const drained = new Deferred<void>();
  timer.onSchedule = (milliseconds) => {
    hooks.onSchedule?.(milliseconds);
  };
  timer.onCancel = (milliseconds) => {
    hooks.onCancel?.(milliseconds);
    if (sealed && timer.pending === 0) drained.resolve();
  };
  return () => {
    sealed = true;
    if (timer.pending === 0) drained.resolve();
    return drained.promise;
  };
}
