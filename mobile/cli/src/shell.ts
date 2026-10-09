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
}

/** Builds one engine over the native module APIs owned by this shell. */
export function createShellAuth<TAlgorithm, TSignal, THandle>(
  modules: ShellModules<TAlgorithm, TSignal, THandle>,
  { configuration, ephemeralBrowserSession }: ShellSettings,
): ShellAuth {
  const ports = createNativePorts(modules, {
    clientId: configuration.clientId,
    environment: configuration.environment,
    ephemeralBrowserSession,
  });
  const engine = createAuthEngine(configuration, {
    ...ports,
    makeTransport: (baseAddress) =>
      createFetchTransport(modules.http, ports.timer, baseAddress, REQUEST_DEADLINE_MS),
  });
  return { engine, client: createApiClient(engine.transport) };
}
