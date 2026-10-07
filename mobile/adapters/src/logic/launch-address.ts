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
