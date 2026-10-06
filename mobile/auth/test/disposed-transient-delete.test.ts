import { describe, expect, it } from 'vitest';
import { CREDENTIAL_DELETE_TIMEOUT_MS } from '../src/constants';
import { parseStoredRecord } from '../src/persistence';
import { createAuthEngine } from './engine';
import {
  CONFIG,
  Deferred,
  ScriptedTransport,
  acceptCode,
  oauthTokenReply,
  successUserReply,
  testPorts,
} from './support';

describe('transient storage cleanup after dispose', () => {
  it('preserves a later record without the disposed authorization operation id', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const blocked = new Deferred<void>();
    const release = new Deferred<void>();
    const cleanupSettled = new Deferred<void>();
    let authorizationWrite: string | undefined;
    ports.credentials.beforeReplace = (value) => {
      if (value.includes('"transaction"')) {
        authorizationWrite = value;
        blocked.resolve();
        return release.promise.then(() => Promise.reject(new Error('write rejected')));
      }
      return Promise.resolve();
    };
    const signIn = engine.signIn();
    await blocked.promise;
    engine.dispose();
    await expect(signIn).resolves.toEqual({ kind: 'disposed' });
    if (!authorizationWrite) throw new Error('Expected an authorization transaction write');
    const parsed = parseStoredRecord(authorizationWrite);
    if (!parsed) throw new Error('Expected a valid authorization record');
    const laterRecord = {
      schemaVersion: parsed.schemaVersion,
      serverBaseAddress: parsed.serverBaseAddress,
      environment: parsed.environment,
      clientId: parsed.clientId,
      installDigest: parsed.installDigest,
    };
    const laterValue = JSON.stringify(laterRecord);
    ports.credentials.value = laterValue;
    ports.timer.onCancel = (milliseconds) => {
      if (milliseconds === CREDENTIAL_DELETE_TIMEOUT_MS) cleanupSettled.resolve();
    };

    release.resolve();
    await cleanupSettled.promise;

    expect(ports.credentials.value).toBe(laterValue);
    expect(ports.credentials.events.filter((event) => event === 'delete:start')).toHaveLength(0);
  });

  it.each(['authorizing', 'exchanging'] as const)(
    'does not delete a successor session after an old %s write fails',
    async (stage) => {
      const firstTransport = new ScriptedTransport();
      const firstPorts = testPorts(firstTransport);
      const first = createAuthEngine(CONFIG, firstPorts);
      await first.restore();
      const blocked = new Deferred<void>();
      const release = new Deferred<void>();
      const cleanupSettled = new Deferred<void>();
      let replaceCount = 0;
      firstPorts.credentials.beforeReplace = (value) => {
        replaceCount += 1;
        const shouldBlock =
          stage === 'authorizing'
            ? replaceCount === 1 && value.includes('"transaction"')
            : replaceCount === 2 && !value.includes('"transaction"');
        if (!shouldBlock) return Promise.resolve();
        blocked.resolve();
        return release.promise.then(() => Promise.reject(new Error('write rejected')));
      };
      const firstOpened = new Deferred<string>();
      firstPorts.authBrowser.beforeOpen = (address) => firstOpened.resolve(address);
      if (stage === 'exchanging') acceptCode(firstPorts.authBrowser);
      const firstSignIn = first.signIn();
      if (stage === 'exchanging') await firstOpened.promise;
      await blocked.promise;
      first.dispose();
      await expect(firstSignIn).resolves.toEqual({ kind: 'disposed' });

      const successorTransport = new ScriptedTransport();
      const successorPorts = testPorts(successorTransport);
      successorPorts.credentials = firstPorts.credentials;
      successorPorts.install = firstPorts.install;
      successorTransport.enqueue(
        oauthTokenReply('successor-access', 'successor-refresh'),
        successUserReply(),
      );
      const successor = createAuthEngine(CONFIG, successorPorts);
      await successor.restore();
      acceptCode(successorPorts.authBrowser);
      await expect(successor.signIn()).resolves.toMatchObject({ kind: 'signedIn' });
      const successorRecord = firstPorts.credentials.value;
      firstPorts.timer.onCancel = (milliseconds) => {
        if (milliseconds === CREDENTIAL_DELETE_TIMEOUT_MS) cleanupSettled.resolve();
      };

      release.resolve();
      await cleanupSettled.promise;

      expect(firstPorts.credentials.value).toBe(successorRecord);
      expect(firstPorts.credentials.value).toContain('successor-refresh');
      successor.dispose();
    },
  );
});
