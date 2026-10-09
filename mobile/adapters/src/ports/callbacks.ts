import type { CallbackPort } from '@app/native-auth';
import { createDeferredLaunchFilter } from '../logic/launch-address';
import type { LinkingApi } from '../types/modules';

type Listener = Parameters<CallbackPort['subscribe']>[0];

function notify(listener: Listener, address: string): void {
  try {
    void Promise.resolve(listener(address)).catch(() => undefined);
  } catch {
    // One listener failing must not keep the link from the others.
  }
}

/** One adapter per app start: it reads the launch address and remembers it. */
export function createCallbackPort(linking: LinkingApi): CallbackPort {
  const subscribers = new Set<{ listener: Listener }>();
  const filter = createDeferredLaunchFilter();
  /** Resolves to whether the system answered. A failed read never rejects. */
  const readLaunch = (): Promise<boolean> =>
    Promise.resolve()
      .then(() => linking.getInitialURL())
      .then(
        (address) => {
          filter.learn(address ?? undefined);
          return true;
        },
        () => false,
      );
  // Read at start, so the launch address is known before the first link event is judged.
  let attempt: Promise<boolean> | undefined = readLaunch();
  let subscription: { remove(): void } | undefined;
  let queue: Promise<void> = Promise.resolve();

  const onLink = (event: { url: string }): void => {
    const address = event.url;
    if (typeof address !== 'string') return;
    const reading = attempt;
    // Events wait for a read in progress and keep their order.
    queue = queue.then(async () => {
      await reading;
      if (!filter.admitEvent(address)) return;
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
      const current = (attempt ??= readLaunch());
      if (!(await current)) {
        // Each call reports one failed read. The next call asks the system again.
        if (attempt === current) attempt = undefined;
        return { kind: 'unavailable' };
      }
      const address = filter.takeLaunch();
      return address === undefined ? { kind: 'none' } : { kind: 'address', address };
    },
  };
}
