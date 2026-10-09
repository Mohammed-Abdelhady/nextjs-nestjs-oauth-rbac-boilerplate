export type Serial = <T>(task: () => Promise<T>) => Promise<T>;

/** Runs one task at a time, in call order. A failed task does not stop the next one. */
export function createSerial(): Serial {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
}
