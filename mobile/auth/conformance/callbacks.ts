import type { CallbackPort } from '../src';
import { CHECK_ID, SAMPLE } from './constants';
import { attempt, expectEqual } from './expect';
import type { ConformanceCheck, ConformanceSubject } from './types';

const initial = (port: CallbackPort) =>
  attempt('callbacks.initialAddress()', () => port.initialAddress());

function listen(port: CallbackPort): { received: string[]; unsubscribe: () => void } {
  const received: string[] = [];
  const unsubscribe = port.subscribe((address) => {
    received.push(address);
  });
  return { received, unsubscribe };
}

async function deliver({ driver }: ConformanceSubject, address: string): Promise<void> {
  await driver.callbacks.deliver(address);
  await driver.settle();
}

/** The launch address may come back from the read or from the listener, never both. */
async function handledOnce(subject: ConformanceSubject, readFirst: boolean): Promise<void> {
  const order = readFirst ? 'read then event' : 'event then read';
  const port = await subject.driver.callbacks.launch(SAMPLE.RETURN_ADDRESS);
  const { received } = listen(port);
  const handed: (string | undefined)[] = [];
  if (readFirst) handed.push(await initial(port));
  await deliver(subject, SAMPLE.RETURN_ADDRESS);
  if (!readFirst) handed.push(await initial(port));
  expectEqual(
    [...handed, ...received].filter((address) => address !== undefined),
    [SAMPLE.RETURN_ADDRESS],
    `launch address repeated as an event (${order})`,
  );
  received.length = 0;
  await deliver(subject, SAMPLE.OTHER_RETURN_ADDRESS);
  expectEqual(received, [SAMPLE.OTHER_RETURN_ADDRESS], `a later, different link (${order})`);
}

export const CALLBACKS_CHECKS: readonly ConformanceCheck[] = [
  {
    id: CHECK_ID.CALLBACKS_COLD_START,
    port: 'callbacks',
    async run({ driver }) {
      const port = await driver.callbacks.launch(SAMPLE.RETURN_ADDRESS);
      expectEqual(await initial(port), SAMPLE.RETURN_ADDRESS, 'first read of the launch address');
      expectEqual(await initial(port), undefined, 'second read of the launch address');
    },
  },
  {
    id: CHECK_ID.CALLBACKS_NO_COLD_START,
    port: 'callbacks',
    async run({ driver }) {
      const port = await driver.callbacks.launch(undefined);
      expectEqual(await initial(port), undefined, 'launch address of a plain start');
    },
  },
  {
    id: CHECK_ID.CALLBACKS_WARM_START,
    port: 'callbacks',
    async run(subject) {
      const port = await subject.driver.callbacks.launch(undefined);
      const { received } = listen(port);
      await deliver(subject, SAMPLE.RETURN_ADDRESS);
      await deliver(subject, SAMPLE.OTHER_RETURN_ADDRESS);
      expectEqual(
        received,
        [SAMPLE.RETURN_ADDRESS, SAMPLE.OTHER_RETURN_ADDRESS],
        'links delivered to the running app',
      );
    },
  },
  {
    id: CHECK_ID.CALLBACKS_SAME_ADDRESS,
    port: 'callbacks',
    async run(subject) {
      await handledOnce(subject, true);
      await subject.driver.reset();
      await handledOnce(subject, false);
    },
  },
  {
    id: CHECK_ID.CALLBACKS_UNSUBSCRIBE,
    port: 'callbacks',
    async run(subject) {
      const port = await subject.driver.callbacks.launch(undefined);
      const removed = listen(port);
      const kept = listen(port);
      await attempt('unsubscribe', () => removed.unsubscribe());
      await deliver(subject, SAMPLE.RETURN_ADDRESS);
      expectEqual(removed.received, [], 'links to a removed listener');
      expectEqual(kept.received, [SAMPLE.RETURN_ADDRESS], 'links to the remaining listener');
      await attempt('a second unsubscribe', () => removed.unsubscribe());
    },
  },
];
