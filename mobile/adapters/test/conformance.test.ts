import { runConformance } from '@app/native-auth/conformance';
import { describe, expect, it } from 'vitest';
import { nativeSubject } from './support/subject';

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
  'authBrowser.redirect',
  'authBrowser.cancelled',
  'authBrowser.dismissed',
  'authBrowser.failed',
  'authBrowser.abort',
  'crypto.pkce-vector',
  'crypto.sha256-bytes',
  'crypto.random-bytes',
  'callbacks.cold-start-once',
  'callbacks.no-cold-start',
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
];

describe('native adapters against the port contracts', () => {
  it('pass every conformance check over fakes of the Expo modules', async () => {
    const results = await runConformance(nativeSubject());

    expect(results.filter((result) => !result.ok)).toEqual([]);
    expect(results.map((result) => result.id)).toEqual(EVERY_CHECK);
  });
});
