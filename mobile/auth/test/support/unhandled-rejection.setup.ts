import { afterAll, expect } from 'vitest';

declare function setImmediate(callback: () => void): unknown;

declare const process: {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
};

const unhandled: unknown[] = [];

function collectUnhandled(reason: unknown): void {
  unhandled.push(reason);
}

process.on('unhandledRejection', collectUnhandled);

afterAll(async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(unhandled.splice(0)).toEqual([]);
});
