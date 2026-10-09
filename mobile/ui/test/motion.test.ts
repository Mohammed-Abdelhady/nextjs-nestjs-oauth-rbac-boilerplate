import { describe, expect, it } from 'vitest';
import { runMotion } from '../src/logic/motion';

function nativeMotion() {
  const events: string[] = [];
  return {
    events,
    settle: () => events.push('settled'),
    create: () => {
      events.push('created');
      return {
        start: () => {
          events.push('started');
        },
        stop: () => {
          events.push('stopped');
        },
      };
    },
  };
}

describe('native motion lifecycle', () => {
  it('settles immediately without starting motion when motion is disabled', () => {
    const native = nativeMotion();
    runMotion(false, native.settle, native.create);
    expect(native.events).toEqual(['settled']);
  });

  it('starts motion and stops and settles it on cleanup', () => {
    const native = nativeMotion();
    const stop = runMotion(true, native.settle, native.create);
    expect(native.events).toEqual(['created', 'started']);
    stop?.();
    expect(native.events).toEqual(['created', 'started', 'stopped', 'settled']);
  });
});
