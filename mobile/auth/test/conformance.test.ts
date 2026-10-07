import { describe, expect, it } from 'vitest';
import { runConformance } from '../conformance';
import { fakeSubject } from './conformance-fakes';

const EVERY_CHECK = [
  'credentials.missing',
  'credentials.found',
  'credentials.replace-overwrites',
  'credentials.replace-atomic',
  'credentials.delete',
  'credentials.locked',
  'credentials.cancelled',
  'credentials.corrupt',
  'credentials.unavailable',
  'credentials.discarded',
  'credentials.write-locked',
  'credentials.write-cancelled',
  'credentials.write-unavailable',
  'authBrowser.redirect',
  'authBrowser.return-address',
  'authBrowser.cancelled',
  'authBrowser.dismissed',
  'authBrowser.failed',
  'authBrowser.abort',
  'crypto.pkce-vector',
  'crypto.sha256-bytes',
  'crypto.random-bytes',
  'callbacks.cold-start-once',
  'callbacks.no-cold-start',
  'callbacks.launch-unavailable',
  'callbacks.warm-start-once',
  'callbacks.same-address-both-ways',
  'callbacks.unsubscribe',
  'clock.monotonic-never-backwards',
  'clock.monotonic-milliseconds',
  'clock.wall-milliseconds',
  'timer.fires-once',
  'timer.cancel',
  'install.found',
  'install.unavailable',
  'install.locked',
];

describe('adapter conformance suite', () => {
  it('passes every check on adapters that meet the port contracts', async () => {
    const results = await runConformance(fakeSubject());

    expect(results.filter((result) => !result.ok)).toEqual([]);
    expect(results.map((result) => result.id)).toEqual(EVERY_CHECK);
  });

  it('files each check under the port it exercises', async () => {
    const results = await runConformance(fakeSubject());

    const countByPort = new Map<string, number>();
    for (const { port } of results) countByPort.set(port, (countByPort.get(port) ?? 0) + 1);
    expect(Object.fromEntries(countByPort)).toEqual({
      credentials: 13,
      authBrowser: 6,
      crypto: 3,
      callbacks: 6,
      clock: 3,
      timer: 2,
      install: 3,
    });
  });

  it('reports a harness that cannot reset instead of passing its checks', async () => {
    const subject = fakeSubject();
    subject.driver.reset = async () => {
      throw new Error('The harness lost the device.');
    };

    const results = await runConformance(subject);

    expect(results).toHaveLength(36);
    expect(new Set(results.map((result) => (result.ok ? 'passed' : result.message)))).toEqual(
      new Set(['The harness lost the device.']),
    );
  });
});
