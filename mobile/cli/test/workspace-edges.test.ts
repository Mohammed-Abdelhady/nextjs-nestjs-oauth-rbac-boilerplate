import * as engine from '@app/native-auth';
import * as adapters from '@app/native-adapters';
import * as adapterTesting from '@app/native-adapters/testing';
import * as sdk from '@app/sdk';
import { describe, expect, it } from 'vitest';

describe('workspace packages seen from the bare shell', () => {
  it('reaches the sign-in engine and the API client', () => {
    expect(typeof engine.createAuthEngine).toBe('function');
    expect(typeof sdk.createApiClient).toBe('function');
  });

  it('reaches the shared adapters and their module fakes through package entries', () => {
    expect(typeof adapters.createNativePorts).toBe('function');
    expect(typeof adapters.createFetchTransport).toBe('function');
    expect(typeof adapterTesting.FakeSecureStore).toBe('function');
    expect(typeof adapterTesting.nativeSubject).toBe('function');
  });
});
