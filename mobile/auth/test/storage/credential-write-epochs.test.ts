import { describe, expect, it } from 'vitest';
import { makeRefreshRecord } from '../../src/refresh/refresh-helpers';
import { AuthRuntime } from '../../src/runtime/runtime';
import { CONFIG, Deferred, ScriptedTransport, testPorts } from '../support/support';

const INSTALL_DIGEST = 'write-epoch-install';

describe('queued credential writes respect their session epoch', () => {
  it('does not start a replace queued before a newer epoch', async () => {
    const ports = testPorts(new ScriptedTransport());
    const runtime = new AuthRuntime(CONFIG, ports);
    runtime.installDigest = INSTALL_DIGEST;
    const original = 'the stored record';
    ports.credentials.value = original;
    const heldWrite = new Deferred<void>();
    const blocker = runtime.enqueueWrite(() => heldWrite.promise, runtime.epoch, true);
    const record = makeRefreshRecord(runtime, INSTALL_DIGEST, {
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      lineageId: 'write-epoch-lineage',
    });
    const replacing = runtime.replaceRecord(record, runtime.epoch);

    runtime.bumpEpoch('signOut');
    heldWrite.resolve();
    await blocker;

    await expect(replacing).resolves.toBe(false);
    expect(ports.credentials.value).toBe(original);
    expect(ports.credentials.events.filter((event) => event === 'replace:start')).toHaveLength(0);
    expect(ports.timer.pending).toBe(0);
  });
});
