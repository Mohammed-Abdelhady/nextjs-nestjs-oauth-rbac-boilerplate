import { createApiClient } from '@app/sdk';
import { createBearerTransport } from './bearer-transport';
import { AuthSessionError } from './errors';
import { createRefreshCoordinator } from './refresh';
import { createRefreshNow } from './refresh-now';
import { createRestoreOperation } from './restore';
import { AuthRuntime } from './runtime';
import { createSignInController } from './sign-in';
import { createSignOutOperation } from './sign-out';
import { validateConfiguration } from './redirect';
import type { AuthConfiguration, AuthDependencies, AuthEngine, AuthSnapshot } from './types/auth';

export function createAuthEngine(
  configuration: AuthConfiguration,
  dependencies: AuthDependencies,
): AuthEngine {
  const validated = validateConfiguration(configuration);
  const runtime = new AuthRuntime(validated, dependencies);
  const coordinator: { current?: ReturnType<typeof createRefreshCoordinator> } = {};
  const transport = createBearerTransport(
    runtime,
    (signal) => {
      const active = coordinator.current;
      if (!active) throw new AuthSessionError();
      return active.ensureCurrentTokens(signal);
    },
    (signal) => {
      const active = coordinator.current;
      if (!active) throw new AuthSessionError();
      return active.refresh(signal);
    },
  );
  const client = createApiClient(transport);
  const revocationClient = createApiClient(runtime.rawTransport);
  const refreshCoordinator = createRefreshCoordinator(runtime, client, revocationClient);
  coordinator.current = refreshCoordinator;
  const signIn = createSignInController(runtime, client, revocationClient);
  const restore = createRestoreOperation(runtime, signIn);
  const signOut = createSignOutOperation(runtime, revocationClient);
  try {
    runtime.unsubscribeCallbacks = dependencies.callbacks.subscribe(signIn.handleAddress);
  } catch {
    runtime.unsubscribeCallbacks = undefined;
  }

  const engine: AuthEngine = {
    get snapshot(): AuthSnapshot {
      return runtime.snapshot;
    },
    transport,
    subscribe: (listener) => runtime.subscribe(listener),
    restore,
    signIn: signIn.signIn,
    signOut,
    refresh: createRefreshNow(runtime, refreshCoordinator),
    dispose: () => {
      runtime.dispose();
    },
  };
  return engine;
}

export { PortAbortController } from './abort-controller';
export * from './errors';
export * from './types';
