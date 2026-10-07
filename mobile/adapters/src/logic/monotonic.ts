/**
 * Wraps an elapsed-time source so a reading never goes below an earlier one.
 * A reading that is not a number is passed on only while there is no earlier
 * one, so the engine sees a broken clock instead of a made-up time.
 */
export function createMonotonicReader(read: () => number): () => number {
  let last: number | undefined;
  return () => {
    const next = read();
    if (!Number.isFinite(next)) return last ?? next;
    if (last === undefined || next > last) last = next;
    return last;
  };
}
