import { describe, expect, it } from 'vitest';
import { createAuthEngine } from '../support/engine';
import { runCase, type PostDisposeFault } from '../support/dispose/dispose-interleaving-harness';
import { watchTimerDrain } from '../support/timer-drain';
import {
  CONFIG,
  Deferred,
  ScriptedTransport,
  acceptCode,
  oauthTokenReply,
  successUserReply,
  testPorts,
} from '../support/support';
import { revokedTokens } from '../support/tracking';

const SIGN_IN_PORT_TARGET_GROUPS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12],
  [13, 14, 15],
  [16, 17, 18],
  [19, 20, 21],
  [22, 23, 24],
  [25, 26, 27],
  [28, 29, 30],
  [31, 32, 33],
  [34, 35, 36],
] as const;

describe('dispose interleavings preserve credential ownership', () => {
  it.each(['signIn', 'refresh', 'signOut'] as const)(
    'disposes at each %s port boundary and microtask offset, with and without a successor',
    async (scenario) => {
      const baseline = await runCase(scenario, 0, 0, false);
      const callCount = baseline.calls.length;
      expect(callCount).toBeGreaterThan(0);
      if (scenario === 'signIn') expect(baseline.calls).toContain('authBrowser.open');
      expect(baseline.calls).toContain(
        scenario === 'signOut' ? 'transport./api/oauth/revoke' : 'transport./api/oauth/token',
      );

      for (let target = 1; target <= callCount; target += 1) {
        for (const gap of [-1, 0, 1, 2, 4, 8, 16]) {
          for (const successor of [false, true]) {
            const result = await runCase(scenario, target, gap, successor);
            expect(
              result.disposed,
              JSON.stringify({ scenario, target, gap, successor, calls: result.calls }),
            ).toBe(true);
            expect(
              result.unguardedWrites,
              JSON.stringify({ scenario, target, gap, successor, calls: result.calls }),
            ).toEqual([]);
            expect(
              result.successorWrites,
              JSON.stringify({ scenario, target, gap, successor, calls: result.calls }),
            ).toEqual([]);
            for (const issued of result.issuedTokens) {
              const parents = result.parents.get(issued) ?? [];
              const saved =
                result.store.value?.includes('"refreshToken":"' + issued + '"') ?? false;
              const heldByRecoveryMarker = parents.some(
                (parent) =>
                  (result.store.value?.includes('"refreshInFlight":true') ?? false) &&
                  (result.store.value?.includes(`"refreshToken":"${parent}"`) ?? false),
              );
              // Revoking any refresh-token ancestor ends the same rotated family.
              const revoked =
                result.revoked.includes(issued) ||
                (result.parents.get(issued) ?? []).some((parent) =>
                  result.revoked.includes(parent),
                );
              expect(
                saved || revoked || heldByRecoveryMarker,
                JSON.stringify({
                  scenario,
                  target,
                  gap,
                  successor,
                  token: issued,
                  saved,
                  revoked,
                  heldByRecoveryMarker,
                }),
              ).toBe(true);
              if (revoked) expect(saved).toBe(false);
            }
            if (successor) expect(result.store.owner).toBe('B');
          }
        }
      }
    },
  );

  it.each(SIGN_IN_PORT_TARGET_GROUPS.map((targets) => ({ targets })))(
    'preserves sign-in token outcomes across port failures for targets %o',
    async ({ targets }) => {
      const baseline = await runCase('signIn', 0, 0, false);
      expect(baseline.calls).toHaveLength(36);
      await verifyLaterPortFaults('signIn', targets);
    },
  );

  it.each(['refresh', 'signOut'] as const)(
    'preserves %s token outcomes when later port calls fail or land late',
    async (scenario) => {
      await verifyLaterPortFaults(scenario);
    },
  );

  it('completes an accepted sign-out when disposal lands during revoke', async () => {
    for (const gap of [1, 2, 4, 8, 16]) {
      const transport = new ScriptedTransport();
      const ports = testPorts(transport);
      const engine = createAuthEngine(CONFIG, ports);
      await engine.restore();
      transport.enqueue(oauthTokenReply('sign-out-access', 'sign-out-refresh'), successUserReply());
      acceptCode(ports.authBrowser);
      await engine.signIn();
      const timersDrained = watchTimerDrain(ports.timer);

      const revokeStarted = new Deferred<void>();
      const revokeCompleted = new Deferred<void>();
      const deleteCompleted = new Deferred<void>();
      const releaseRevoke = new Deferred<{ status: number; body: unknown }>();
      let revokeAborted = false;
      ports.credentials.afterDelete = () => deleteCompleted.resolve();
      transport.respond = async (request) => {
        if (request.path !== '/api/oauth/revoke')
          throw new Error('Unexpected request: ' + request.path);
        revokeStarted.resolve();
        return new Promise((resolve, reject) => {
          const abort = (): void => {
            revokeAborted = true;
            revokeCompleted.resolve();
            reject(new Error('revoke aborted'));
          };
          request.signal?.addEventListener('abort', abort);
          void releaseRevoke.promise.then((response) => {
            request.signal?.removeEventListener('abort', abort);
            resolve(response);
          });
        });
      };
      transport.onResponse = (request) => {
        if (request.path === '/api/oauth/revoke') revokeCompleted.resolve();
      };

      const signOut = engine.signOut();
      await revokeStarted.promise;
      for (let index = 0; index < gap; index += 1) await Promise.resolve();
      engine.dispose();
      releaseRevoke.resolve({ status: 200, body: {} });
      const [outcome] = await Promise.all([
        signOut,
        revokeCompleted.promise,
        deleteCompleted.promise,
      ]);
      await timersDrained();

      expect(outcome).toEqual({ kind: 'disposed' });
      expect(revokeAborted).toBe(false);
      expect(revokedTokens(transport)).toEqual(['sign-out-refresh']);
      expect(ports.credentials.value).toBeUndefined();
      expect(ports.timer.pending).toBe(0);
    }
  });
});

async function verifyLaterPortFaults(
  scenario: 'signIn' | 'refresh' | 'signOut',
  targets?: readonly number[],
): Promise<void> {
  const baseline = await runCase(scenario, 0, 0, false);
  const boundaryTargets =
    targets ?? Array.from({ length: baseline.calls.length }, (_, index) => index + 1);
  for (const target of boundaryTargets) {
    const disposed = await runCase(scenario, target, 0, false);
    for (let ordinal = 1; ordinal <= disposed.postDisposeCalls.length; ordinal += 1) {
      const name = disposed.postDisposeCalls[ordinal - 1];
      if (!name) continue;
      const canFail = name !== 'transport./api/oauth/revoke' && name !== 'timer.after';
      const modes: readonly PostDisposeFault['mode'][] = canFail ? ['fail', 'late'] : ['late'];
      for (const mode of modes) {
        if (mode === 'late' && !isAsyncPortCall(name)) continue;
        await assertFaultOutcome(scenario, target, ordinal, mode);
      }
    }
  }
}

async function assertFaultOutcome(
  scenario: 'signIn' | 'refresh' | 'signOut',
  target: number,
  ordinal: number,
  mode: PostDisposeFault['mode'],
): Promise<void> {
  const result = await runCase(scenario, target, 0, false, { ordinal, mode });
  expect(result.disposed).toBe(true);
  expect(result.unguardedWrites).toEqual([]);
  expect(result.successorWrites).toEqual([]);
  for (const token of result.issuedTokens) {
    const parents = result.parents.get(token) ?? [];
    const saved = result.store.value?.includes(`"refreshToken":"${token}"`) ?? false;
    const heldByRecoveryMarker = parents.some(
      (parent) =>
        (result.store.value?.includes('"refreshInFlight":true') ?? false) &&
        (result.store.value?.includes(`"refreshToken":"${parent}"`) ?? false),
    );
    const revoked =
      result.revoked.includes(token) ||
      (result.parents.get(token) ?? []).some((parent) => result.revoked.includes(parent));
    expect(saved || revoked || heldByRecoveryMarker).toBe(true);
    if (revoked) expect(saved).toBe(false);
  }
}

function isAsyncPortCall(name: string): boolean {
  return (
    name.startsWith('credentials.') ||
    name === 'authBrowser.open' ||
    name.startsWith('crypto.') ||
    name === 'callbacks.initialAddress' ||
    name === 'install.identity' ||
    name.startsWith('transport.')
  );
}
