import type { TransportRequest } from '@app/sdk';
import {
  AuthDisposedError,
  type AbortSignalPort,
  type AuthDependencies,
  type AuthEngine,
  type TimerPort,
} from '../src';
import { createAuthEngine } from './engine';
import type { Audit, PostDisposeFault, Scenario, SharedStore } from './dispose-interleaving-types';
import { refreshParent, requestToken } from './dispose-interleaving-tokens';
import {
  CONFIG,
  Deferred,
  ScriptedTransport,
  acceptCode,
  oauthTokenReply,
  successUserReply,
  testPorts,
} from './support';
import { revokedTokens } from './tracking';

export type { PostDisposeFault, Scenario } from './dispose-interleaving-types';

let nextTokenNumber = 0;

export async function runCase(
  scenario: Scenario,
  target: number,
  gap: number,
  withSuccessor: boolean,
  fault?: PostDisposeFault,
) {
  const store: SharedStore = { value: undefined, owner: 'empty' };
  const audit: Audit = {
    active: scenario === 'signIn',
    disposed: false,
    requestedDispose: false,
    calls: [],
    postDisposeCalls: [],
    faultOrdinal: fault?.ordinal,
    faultMode: fault?.mode,
    faultReady: new Deferred<void>(),
    faultRelease: undefined,
    target,
    gap,
    disposeGate: new Deferred<void>(),
    readSinceDispose: false,
    unguardedWrites: [],
    successorWrites: [],
    issuedTokens: [],
    activeTransportActor: undefined,
    engine: undefined,
  };
  const transport = new ScriptedTransport();
  transport.respond = async ({ path, body }) => {
    if (path === '/api/oauth/token') {
      nextTokenNumber += 1;
      const token = `refresh-${nextTokenNumber}`;
      if (audit.active && audit.activeTransportActor)
        audit.issuedTokens.push({
          actor: audit.activeTransportActor,
          token,
          parent: refreshParent(body),
          settled: new Deferred<void>(),
        });
      const parent = refreshParent(body);
      if (
        parent &&
        store.value?.includes('"refreshInFlight":true') &&
        store.value.includes(`"refreshToken":"${parent}"`)
      )
        audit.issuedTokens
          .filter((issued) => issued.token === token)
          .forEach((issued) => issued.settled.resolve());
      return oauthTokenReply(`access-${nextTokenNumber}`, token);
    }
    if (path === '/api/oauth/revoke') return { status: 200, body: {} };
    return successUserReply();
  };
  transport.onResponse = (request) => {
    if (request.path !== '/api/oauth/revoke') return;
    const token = requestToken(request.body);
    audit.issuedTokens
      .filter((issued) => issued.token === token || issued.parent === token)
      .forEach((issued) => issued.settled.resolve());
  };
  const firstRig = makeEngine('A', store, audit, transport);
  const first = firstRig.engine;
  audit.engine = first;
  const flow = (async () => {
    if (scenario === 'signIn') {
      audit.active = true;
      const restored = await first.restore();
      if (restored.kind === 'restored' && first.snapshot.status === 'signedOut') {
        acceptCode(firstRig.browser);
        await first.signIn();
      }
      return;
    }
    await first.restore();
    acceptCode(firstRig.browser);
    await first.signIn();
    audit.calls.length = 0;
    audit.readSinceDispose = false;
    audit.active = true;
    if (scenario === 'refresh') {
      firstRig.ports.clock.advance(270_000);
      await first.transport
        .request({ method: 'GET', path: '/api/user/profile' })
        .catch((error: unknown) => {
          if (!(error instanceof AuthDisposedError)) throw error;
        });
      return;
    }
    await first.signOut();
  })();
  if (fault?.mode === 'late') {
    await audit.faultReady.promise;
    audit.faultRelease?.resolve();
  }
  await flow.catch((error: unknown) => {
    if (!fault) throw error;
  });
  if (target !== 0) await audit.disposeGate.promise;

  if (withSuccessor) {
    const secondRig = makeEngine('B', store, audit, transport);
    const second = secondRig.engine;
    const restored = await second.restore();
    if (restored.kind === 'restored' && second.snapshot.status === 'signedIn')
      await second.signOut();
    acceptCode(secondRig.browser);
    const result = await second.signIn();
    if (result.kind !== 'signedIn') throw new Error('Expected the successor sign-in to succeed');
    second.dispose();
  }

  first.dispose();
  await Promise.all(
    audit.issuedTokens.filter(({ actor }) => actor === 'A').map(({ settled }) => settled.promise),
  );
  return {
    calls: audit.calls,
    postDisposeCalls: audit.postDisposeCalls,
    disposed: audit.disposed,
    unguardedWrites: audit.unguardedWrites,
    successorWrites: audit.successorWrites,
    issuedTokens: audit.issuedTokens.filter(({ actor }) => actor === 'A').map(({ token }) => token),
    parents: new Map(
      audit.issuedTokens
        .filter(({ actor }) => actor === 'A')
        .map(({ token, parent }) => [token, parent === undefined ? [] : [parent]]),
    ),
    revoked: revokedTokens(transport),
    store,
  };
}

function makeEngine(
  actor: string,
  store: SharedStore,
  audit: Audit,
  transport: ScriptedTransport,
): {
  engine: AuthEngine;
  browser: ReturnType<typeof testPorts>['authBrowser'];
  ports: ReturnType<typeof testPorts>;
} {
  const base = testPorts(transport);
  const tap = <T>(name: string, action: () => T, mutation = false): T => {
    const call = observeCall(actor, audit, store, name, mutation);
    if (!call) return action();
    if (call.number === audit.target && audit.gap < 0) scheduleDispose(audit);
    if (faultMatches(audit, call)) {
      if (audit.faultMode === 'fail') throw new Error(`Scripted post-dispose failure: ${name}`);
    }
    const result = action();
    if (call.number === audit.target && audit.gap >= 0) scheduleDispose(audit);
    return result;
  };
  const tapAsync = async <T>(
    name: string,
    action: () => Promise<T>,
    mutation = false,
  ): Promise<T> => {
    const call = observeCall(actor, audit, store, name, mutation);
    if (!call) return action();
    if (call.number === audit.target && audit.gap < 0) scheduleDispose(audit);
    if (faultMatches(audit, call)) {
      if (audit.faultMode === 'fail') {
        throw new Error(`Scripted post-dispose failure: ${name}`);
      }
      audit.faultRelease = new Deferred<void>();
      audit.faultReady.resolve();
      await audit.faultRelease.promise;
    }
    const result = action();
    if (call.number === audit.target && audit.gap >= 0) scheduleDispose(audit);
    const value = await result;
    if (name === 'credentials.read' && call.afterDispose) audit.readSinceDispose = true;
    return value;
  };
  const dependencies: AuthDependencies & { timer: TimerPort & { pending: number } } = {
    credentials: {
      read: () =>
        tapAsync('credentials.read', async () => {
          return store.value === undefined
            ? { kind: 'missing' as const }
            : { kind: 'found' as const, value: store.value };
        }),
      replace: (value) =>
        tapAsync(
          'credentials.replace',
          async () => {
            store.value = value;
            store.owner = actor;
            audit.issuedTokens
              .filter(
                (issued) =>
                  issued.actor === actor && value.includes(`"refreshToken":"${issued.token}"`),
              )
              .forEach((issued) => issued.settled.resolve());
          },
          true,
        ),
      delete: () =>
        tapAsync(
          'credentials.delete',
          async () => {
            store.value = undefined;
            store.owner = actor;
          },
          true,
        ),
    },
    authBrowser: {
      open: (address, signal) =>
        tapAsync('authBrowser.open', () => base.authBrowser.open(address, signal)),
    },
    crypto: {
      randomBytes: (length) =>
        tapAsync('crypto.randomBytes', () => base.crypto.randomBytes(length)),
      sha256: (bytes) => tapAsync('crypto.sha256', () => base.crypto.sha256(bytes)),
    },
    callbacks: {
      subscribe: (listener) => tap('callbacks.subscribe', () => base.callbacks.subscribe(listener)),
      initialAddress: () =>
        tapAsync('callbacks.initialAddress', () => base.callbacks.initialAddress()),
    },
    clock: {
      wallTime: () => tap('clock.wallTime', () => base.clock.wallTime()),
      monotonicTime: () => tap('clock.monotonicTime', () => base.clock.monotonicTime()),
    },
    timer: {
      after: (milliseconds, callback) =>
        tap('timer.after', () => base.timer.after(milliseconds, callback)),
      get pending() {
        return base.timer.pending;
      },
    },
    install: {
      identity: () => tapAsync('install.identity', () => base.install.identity()),
    },
    makeTransport: (baseAddress) =>
      tap('makeTransport', () => {
        const raw = base.makeTransport(baseAddress);
        return {
          request: (request: TransportRequest<AbortSignalPort>) =>
            tapAsync(`transport.${request.path}`, async () => {
              const previousActor = audit.activeTransportActor;
              audit.activeTransportActor = actor;
              try {
                return await raw.request(request);
              } finally {
                audit.activeTransportActor = previousActor;
              }
            }),
        };
      }),
  };
  const engine = createAuthEngine(CONFIG, dependencies);
  if (actor === 'A' && audit.requestedDispose) engine.dispose();
  return { engine, browser: base.authBrowser, ports: base };
}

function scheduleDispose(audit: Audit): void {
  const dispose = (): void => {
    audit.disposed = true;
    audit.requestedDispose = true;
    audit.engine?.dispose();
    audit.disposeGate.resolve();
  };
  if (audit.gap <= 0) {
    dispose();
    return;
  }
  void (async () => {
    for (let index = 0; index < audit.gap; index += 1) await Promise.resolve();
    dispose();
  })();
}

function observeCall(
  actor: string,
  audit: Audit,
  store: SharedStore,
  name: string,
  mutation: boolean,
): { number: number; afterDispose: boolean; postDisposeOrdinal: number } | undefined {
  if (actor !== 'A' || !audit.active) return undefined;
  const number = audit.calls.length + 1;
  audit.calls.push(name);
  const afterDispose = audit.disposed;
  const postDisposeOrdinal = afterDispose ? audit.postDisposeCalls.push(name) : 0;
  if (mutation) {
    if (afterDispose && !audit.readSinceDispose) audit.unguardedWrites.push(`${actor}:${name}`);
    if (afterDispose && store.owner === 'B') audit.successorWrites.push(`${actor}:${name}`);
    if (afterDispose) audit.readSinceDispose = false;
  }
  return { number, afterDispose, postDisposeOrdinal };
}

function faultMatches(audit: Audit, call: { postDisposeOrdinal: number }): boolean {
  return audit.faultOrdinal === call.postDisposeOrdinal && audit.faultMode !== undefined;
}
