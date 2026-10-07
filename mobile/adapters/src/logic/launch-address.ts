export interface LaunchAddressFilter {
  /** The launch address on the first read, unless a link event already carried it. */
  takeLaunch(): string | undefined;
  /** Whether an address from a link event should reach the listeners. */
  admitEvent(address: string): boolean;
}

/**
 * The system may repeat the address that started the app as its first link
 * event. Whichever of the read and that event comes first hands it over.
 */
export interface DeferredLaunchFilter extends LaunchAddressFilter {
  /** Tells the filter what the launch address is, once the read has answered. */
  learn(launchAddress: string | undefined): void;
}

/**
 * The same rule while the launch address is not known yet, as after a failed
 * read. Events are delivered meanwhile. Only the first of them can have been
 * the repeat, so it is replayed into the filter when the address is learned.
 */
export function createDeferredLaunchFilter(): DeferredLaunchFilter {
  let inner: LaunchAddressFilter | undefined;
  let firstEvent: { address: string } | undefined;
  return {
    learn(launchAddress) {
      if (inner) return;
      inner = createLaunchAddressFilter(launchAddress);
      if (firstEvent) inner.admitEvent(firstEvent.address);
    },
    takeLaunch: () => inner?.takeLaunch(),
    admitEvent(address) {
      if (inner) return inner.admitEvent(address);
      firstEvent ??= { address };
      return true;
    },
  };
}

export function createLaunchAddressFilter(launchAddress: string | undefined): LaunchAddressFilter {
  let unread = launchAddress;
  let possibleRepeat = launchAddress;
  let handed = false;
  return {
    takeLaunch() {
      const address = unread;
      unread = undefined;
      handed = true;
      return address;
    },
    admitEvent(address) {
      const repeatsLaunch = possibleRepeat !== undefined && address === possibleRepeat;
      possibleRepeat = undefined;
      if (!repeatsLaunch) return true;
      if (handed) return false;
      handed = true;
      unread = undefined;
      return true;
    },
  };
}
