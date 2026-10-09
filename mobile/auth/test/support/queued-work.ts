declare function setImmediate(callback: () => void): unknown;

/** Resolves once every continuation already queued has run. It waits on no duration. */
export function queuedWorkDone(): Promise<void> {
  return new Promise<void>((resolve) => setImmediate(resolve));
}
