import type { CallbackPort } from '@app/native-auth';
import { createLaunchAddressFilter } from '../logic/launch-address';
import type { LinkingApi } from '../types/modules';

type Listener = Parameters<CallbackPort['subscribe']>[0];

function notify(listener: Listener, address: string): void {
  try {
    void Promise.resolve(listener(address)).catch(() => undefined);
  } catch {
    // One listener failing must not keep the link from the others.
  }
}

/** One adapter per app start: it reads the launch address once and remembers it. */
export function createCallbackPort(linking: LinkingApi): CallbackPort {
  const subscribers = new Set<{ listener: Listener }>();
  const launch = Promise.resolve()
    .then(() => linking.getInitialURL())
    .then((address) => address ?? undefined);
  // A failed read leaves no launch address to repeat, so every event is delivered.
  const filter = launch.then(createLaunchAddressFilter, () => createLaunchAddressFilter(undefined));
  let subscription: { remove(): void } | undefined;
  let queue: Promise<void> = Promise.resolve();

  const onLink = (event: { url: string }): void => {
    const address = event.url;
    if (typeof address !== 'string') return;
    // Events wait for the launch read and keep their order.
    queue = queue.then(async () => {
      if (!(await filter).admitEvent(address)) return;
      for (const { listener } of [...subscribers]) notify(listener, address);
    });
  };

  return {
    subscribe(listener) {
      const subscriber = { listener };
      subscribers.add(subscriber);
      subscription ??= linking.addEventListener('url', onLink);
      return () => {
        if (!subscribers.delete(subscriber) || subscribers.size > 0) return;
        subscription?.remove();
        subscription = undefined;
      };
    },
    async initialAddress() {
      await launch;
      return (await filter).takeLaunch();
    },
  };
}
