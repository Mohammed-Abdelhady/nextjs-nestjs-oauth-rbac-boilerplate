import {
  CHECK_ID,
  ELAPSE_CEILING_FACTOR,
  ELAPSE_MS,
  MONOTONIC_SAMPLES,
  TIMER_DELAY_MS,
  WALL_JUMP_BACK_MS,
  WALL_TIME_RANGE_MS,
} from './constants';
import { attempt, expectEqual, expectTrue } from './expect';
import type { ConformanceCheck, ConformanceSubject } from './types';

type Reading = 'wallTime' | 'monotonicTime';

const reading = ({ adapters }: ConformanceSubject, kind: Reading): Promise<number> =>
  attempt(`clock.${kind}()`, () => adapters.clock[kind]());

async function expectMillisecondSteps(subject: ConformanceSubject, kind: Reading): Promise<void> {
  const before = await reading(subject, kind);
  await subject.driver.time.elapse(ELAPSE_MS);
  const moved = (await reading(subject, kind)) - before;
  expectTrue(
    moved >= ELAPSE_MS && moved < ELAPSE_MS * ELAPSE_CEILING_FACTOR,
    `clock.${kind}() moved ${moved} while ${ELAPSE_MS} ms passed`,
  );
}

function counter(): { readonly count: number; tick(): void } {
  let count = 0;
  return {
    get count() {
      return count;
    },
    tick: () => {
      count += 1;
    },
  };
}

async function pass({ driver }: ConformanceSubject, milliseconds: number): Promise<void> {
  await driver.time.elapse(milliseconds);
  await driver.settle();
}

export const CLOCK_CHECKS: readonly ConformanceCheck[] = [
  {
    id: CHECK_ID.CLOCK_MONOTONIC,
    port: 'clock',
    async run(subject) {
      let last = await reading(subject, 'monotonicTime');
      const expectForward = async (when: string): Promise<void> => {
        const next = await reading(subject, 'monotonicTime');
        expectTrue(next >= last, `monotonic time went from ${last} back to ${next} ${when}`);
        last = next;
      };
      for (let sample = 0; sample < MONOTONIC_SAMPLES; sample += 1) {
        await expectForward('between reads');
      }
      await subject.driver.time.jumpWall(WALL_JUMP_BACK_MS);
      await expectForward('after the wall clock moved back');
      await subject.driver.time.elapse(ELAPSE_MS);
      await expectForward('after time passed');
    },
  },
  {
    id: CHECK_ID.CLOCK_MONOTONIC_UNIT,
    port: 'clock',
    run: (subject) => expectMillisecondSteps(subject, 'monotonicTime'),
  },
  {
    id: CHECK_ID.CLOCK_WALL_UNIT,
    port: 'clock',
    async run(subject) {
      const wall = await reading(subject, 'wallTime');
      expectTrue(
        wall >= WALL_TIME_RANGE_MS.MIN && wall < WALL_TIME_RANGE_MS.MAX,
        `clock.wallTime() is not a date in milliseconds: ${wall}`,
      );
      await expectMillisecondSteps(subject, 'wallTime');
    },
  },
];

export const TIMER_CHECKS: readonly ConformanceCheck[] = [
  {
    id: CHECK_ID.TIMER_FIRES_ONCE,
    port: 'timer',
    async run(subject) {
      const fired = counter();
      await attempt('timer.after()', () =>
        subject.adapters.timer.after(TIMER_DELAY_MS, fired.tick),
      );
      await pass(subject, TIMER_DELAY_MS / 2);
      expectEqual(fired.count, 0, 'calls before the delay passed');
      await pass(subject, TIMER_DELAY_MS / 2);
      expectEqual(fired.count, 1, 'calls once the delay passed');
      await pass(subject, TIMER_DELAY_MS * ELAPSE_CEILING_FACTOR);
      expectEqual(fired.count, 1, 'calls long after the delay passed');
    },
  },
  {
    id: CHECK_ID.TIMER_CANCEL,
    port: 'timer',
    async run(subject) {
      const cancelled = counter();
      const cancel = subject.adapters.timer.after(TIMER_DELAY_MS, cancelled.tick);
      await attempt('cancel', () => cancel());
      await pass(subject, TIMER_DELAY_MS * 2);
      expectEqual(cancelled.count, 0, 'calls after cancel');
      await attempt('a second cancel', () => cancel());

      const fired = counter();
      const cancelFired = subject.adapters.timer.after(TIMER_DELAY_MS, fired.tick);
      await pass(subject, TIMER_DELAY_MS);
      expectEqual(fired.count, 1, 'calls of a timer left alone');
      await attempt('cancel after firing', () => cancelFired());
    },
  },
];
