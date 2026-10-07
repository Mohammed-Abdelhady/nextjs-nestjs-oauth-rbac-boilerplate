import {
  createFetchTransport,
  createNativePorts,
  REQUEST_DEADLINE_MS,
  type HttpApi,
  type NativeModules,
} from '@app/native-adapters';
import {
  createAuthEngine,
  type AbortSignalPort,
  type AuthConfiguration,
  type AuthEngine,
} from '@app/native-auth';
import { createApiClient, type ApiClient } from '@app/sdk';
import { SHELL_FAILURE } from './constants';
import { createDebugTransport, type DebugTransport } from './logic/debug-transport';

/** Everything native the shell touches, so a test can stand in for all of it. */
export interface ShellModules<TAlgorithm, TSignal, THandle> extends NativeModules<
  TAlgorithm,
  THandle
> {
  http: HttpApi<TSignal>;
}

export interface ShellSettings {
  configuration: AuthConfiguration;
  ephemeralBrowserSession: boolean;
}

export interface ShellAuth {
  engine: AuthEngine;
  client: ApiClient<AbortSignalPort>;
  debug: DebugTransport;
}

/** One engine for the app's one credential record. */
export function createShellAuth<TAlgorithm, TSignal, THandle>(
  modules: ShellModules<TAlgorithm, TSignal, THandle>,
  { configuration, ephemeralBrowserSession }: ShellSettings,
): ShellAuth {
  const ports = createNativePorts(modules, {
    clientId: configuration.clientId,
    environment: configuration.environment,
    ephemeralBrowserSession,
  });
  const transports: DebugTransport[] = [];
  const engine = createAuthEngine(configuration, {
    ...ports,
    makeTransport(baseAddress) {
      const debug = createDebugTransport(
        createFetchTransport(modules.http, ports.timer, baseAddress, REQUEST_DEADLINE_MS),
      );
      transports.push(debug);
      return debug.transport;
    },
  });
  const [debug] = transports;
  if (debug === undefined) throw new Error(SHELL_FAILURE.NO_TRANSPORT);
  return { engine, client: createApiClient(engine.transport), debug };
}
