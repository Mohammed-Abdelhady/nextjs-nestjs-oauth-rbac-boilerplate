import { describe, expect, it } from 'vitest';
import { unclassifiedMutationNames } from '@/store/api/__tests__/mutationSweepGuard';
import {
  CONVERTED as CORE_CONVERTED,
  EXCEPTIONS,
} from '@/store/api/__tests__/invalidationRefetchCases';
import { UNTAGGED as CORE_UNTAGGED } from '@/store/api/__tests__/untaggedRefetchCases';
import { CONVERTED } from './sweepCases';
import { profileSyncApi } from '../profileSyncApi';

describe('mutation sweep coverage', () => {
  it('classifies every mutation endpoint its import graph holds', () => {
    const classified = [
      ...[...CORE_CONVERTED, ...EXCEPTIONS, ...CORE_UNTAGGED, ...CONVERTED].map(
        (mutation) => mutation.name,
      ),
    ];
    expect(new Set(classified).size).toBe(classified.length);
    // The endpoint objects are shared, so one registry of the graph (the sync
    // slice, shared with the linking one) lists every mutation this test's
    // imports hold.
    expect(unclassifiedMutationNames(profileSyncApi, classified)).toEqual([]);
  });
});
