import { describe, expect, it } from 'vitest';
import { CREDENTIAL_WRITE_TIMEOUT_MS } from '../../src/constants';
import { createAuthEngine } from '../support/engine';
import { queuedWorkDone } from '../support/queued-work';
import {
  CONFIG,
  Deferred,
  REFRESH_TOKEN,
  ScriptedTransport,
  acceptCode,
  oauthTokenReply,
  testPorts,
} from '../support/support';
import { revokedTokens } from '../support/tracking';

describe('a sign-in whose token write passes its deadline', () => {
  it('deletes the revoked token record when the write lands late', async () => {
    const transport = new ScriptedTransport();
    const ports = testPorts(transport);
    const engine = createAuthEngine(CONFIG, ports);
    await engine.restore();
    const writeStarted = new Deferred<void>();
    const finishWrite = new Deferred<void>();
    ports.credentials.beforeReplace = (value) => {
      if (!value.includes('"tokens"')) return Promise.resolve();
      ports.credentials.beforeReplace = undefined;
      writeStarted.resolve();
      return finishWrite.promise;
    };
    transport.enqueue(oauthTokenReply(), { status: 200, body: {} });
    acceptCode(ports.authBrowser);

    const signIn = engine.signIn();
    await writeStarted.promise;
    ports.timer.fireDelay(CREDENTIAL_WRITE_TIMEOUT_MS);
    const outcome = await signIn;
    const statusAtDeadline = engine.snapshot.status;
    finishWrite.resolve();
    await queuedWorkDone();
    const restored = await engine.restore();

    expect(outcome.kind).toBe('storageFailure');
    expect(statusAtDeadline).toBe('storageBlocked');
    expect(revokedTokens(transport)).toEqual([REFRESH_TOKEN]);
    expect(ports.credentials.value).toBeUndefined();
    expect(restored).toEqual({ kind: 'restored', status: 'signedOut' });
    expect(engine.snapshot).toEqual({ status: 'signedOut', operation: 'none' });
    expect(transport.sent.map(({ path }) => path)).toEqual([
      '/api/oauth/token',
      '/api/oauth/revoke',
    ]);
  });
});
