import { describe, expect, it } from 'vitest';
import { unclassifiedMutationNames } from '@/store/api/__tests__/mutationSweepGuard';
import {
  CONVERTED as CORE_CONVERTED,
  EXCEPTIONS,
} from '@/store/api/__tests__/invalidationRefetchCases';
import { UNTAGGED as CORE_UNTAGGED } from '@/store/api/__tests__/untaggedRefetchCases';
import { CONVERTED, UNTAGGED } from './sweepCases';
import { passkeysApi } from '../passkeysApi';

describe('mutation sweep coverage', () => {
  it('classifies every mutation endpoint its import graph holds', () => {
    const classified = [
      ...[...CORE_CONVERTED, ...EXCEPTIONS, ...CORE_UNTAGGED, ...CONVERTED, ...UNTAGGED].map(
        (mutation) => mutation.name,
      ),
    ];
    expect(new Set(classified).size).toBe(classified.length);
    expect(unclassifiedMutationNames(passkeysApi, classified)).toEqual([]);
  });
});
