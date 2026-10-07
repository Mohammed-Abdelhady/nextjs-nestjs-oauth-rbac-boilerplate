import * as engine from '@app/native-auth';
import * as conformance from '@app/native-auth/conformance';
import * as sdk from '@app/sdk';
import { describe, expect, it } from 'vitest';

describe('workspace packages seen from the bare shell', () => {
  it('reaches the sign-in engine and the API client', () => {
    expect(typeof engine.createAuthEngine).toBe('function');
    expect(typeof sdk.createApiClient).toBe('function');
  });

  it('reaches the adapter conformance suite through its own entry', () => {
    expect(typeof conformance.runConformance).toBe('function');
    expect(conformance.CONFORMANCE_CHECKS).toHaveLength(29);
  });
});
