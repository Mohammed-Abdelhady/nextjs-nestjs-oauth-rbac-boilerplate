import type { ConformanceDriver } from './types';

export class ConformanceFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConformanceFailure';
  }
}

export function fail(message: string): never {
  throw new ConformanceFailure(message);
}

export function describeValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value instanceof Uint8Array) return `bytes[${[...value].join(',')}]`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function expectEqual(actual: unknown, expected: unknown, what: string): void {
  const got = describeValue(actual);
  const wanted = describeValue(expected);
  if (got !== wanted) fail(`${what}: expected ${wanted}, got ${got}`);
}

export function expectTrue(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

export function expectBytes(actual: unknown, expected: readonly number[], what: string): void {
  if (!(actual instanceof Uint8Array))
    fail(`${what}: expected bytes, got ${describeValue(actual)}`);
  expectEqual([...actual], [...expected], what);
}

/** Runs a port call and reports a throw or rejection as a contract failure. */
export async function attempt<T>(what: string, action: () => T | Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    return fail(`${what} must not throw or reject, got ${describeValue(error)}`);
  }
}

export type Settlement<T> =
  { state: 'pending' } | { state: 'resolved'; value: T } | { state: 'rejected'; error: unknown };

/** Reads where a promise stands once the harness says pending work is done. */
export async function settlement<T>(
  promise: Promise<T>,
  driver: ConformanceDriver,
): Promise<Settlement<T>> {
  const box: { current: Settlement<T> } = { current: { state: 'pending' } };
  void promise.then(
    (value) => {
      box.current = { state: 'resolved', value };
    },
    (error: unknown) => {
      box.current = { state: 'rejected', error };
    },
  );
  await driver.settle();
  return box.current;
}
