import * as adapters from '@app/native-adapters';
import * as adapterFakes from '@app/native-adapters/testing';
import * as engine from '@app/native-auth';
import * as conformance from '@app/native-auth/conformance';
import * as sdk from '@app/sdk';
import { describe, expect, it } from 'vitest';

describe('workspace packages seen from the Expo shell', () => {
  it('reaches the sign-in engine and the API client', () => {
    expect(typeof engine.createAuthEngine).toBe('function');
    expect(typeof sdk.createApiClient).toBe('function');
  });

  it('reaches the adapter conformance suite through its own entry', () => {
    expect(typeof conformance.runConformance).toBe('function');
    expect(conformance.CONFORMANCE_CHECKS).toHaveLength(36);
  });

  it('reaches the shared adapters and their module fakes through separate entries', () => {
    expect(typeof adapters.createNativePorts).toBe('function');
    expect(typeof adapterFakes.nativeSubject).toBe('function');
    expect('nativeSubject' in adapters).toBe(false);
  });
});
