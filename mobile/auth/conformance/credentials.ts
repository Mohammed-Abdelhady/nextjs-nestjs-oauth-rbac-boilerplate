import { CHECK_ID, SAMPLE } from './constants';
import { attempt, expectEqual, fail } from './expect';
import type { ConformanceCheck, ConformanceSubject, CredentialCondition } from './types';

const read = ({ adapters }: ConformanceSubject) =>
  attempt('credentials.read()', () => adapters.credentials.read());

const replace = ({ adapters }: ConformanceSubject, value: string) =>
  attempt('credentials.replace()', () => adapters.credentials.replace(value));

/** A blocked read must say why. Reading it as "no account" signs the person out. */
function conditionCheck(
  id: ConformanceCheck['id'],
  condition: CredentialCondition,
): ConformanceCheck {
  return {
    id,
    port: 'credentials',
    async run(subject) {
      await replace(subject, SAMPLE.RECORD);
      await subject.driver.credentials.force(condition);
      expectEqual(await read(subject), { kind: condition }, `read of a ${condition} store`);
    },
  };
}

export const CREDENTIALS_CHECKS: readonly ConformanceCheck[] = [
  {
    id: CHECK_ID.CREDENTIALS_MISSING,
    port: 'credentials',
    async run(subject) {
      expectEqual(await read(subject), { kind: 'missing' }, 'read of an empty store');
    },
  },
  {
    id: CHECK_ID.CREDENTIALS_FOUND,
    port: 'credentials',
    async run(subject) {
      await replace(subject, SAMPLE.RECORD);
      expectEqual(
        await read(subject),
        { kind: 'found', value: SAMPLE.RECORD },
        'read after replace',
      );
    },
  },
  {
    id: CHECK_ID.CREDENTIALS_REPLACE_OVERWRITES,
    port: 'credentials',
    async run(subject) {
      await replace(subject, SAMPLE.RECORD);
      await replace(subject, SAMPLE.NEXT_RECORD);
      expectEqual(
        await read(subject),
        { kind: 'found', value: SAMPLE.NEXT_RECORD },
        'read after a second replace',
      );
    },
  },
  {
    id: CHECK_ID.CREDENTIALS_REPLACE_ATOMIC,
    port: 'credentials',
    async run(subject) {
      await replace(subject, SAMPLE.NEXT_RECORD);
      await subject.driver.credentials.failNextReplace();
      let reported = 'success';
      try {
        await subject.adapters.credentials.replace(SAMPLE.RECORD);
      } catch {
        reported = 'failure';
      }
      if (reported !== 'failure') fail('a replace that failed to write must reject');
      expectEqual(
        await read(subject),
        { kind: 'found', value: SAMPLE.NEXT_RECORD },
        'read after a failed replace',
      );
    },
  },
  {
    id: CHECK_ID.CREDENTIALS_DELETE,
    port: 'credentials',
    async run(subject) {
      await replace(subject, SAMPLE.RECORD);
      await attempt('credentials.delete()', () => subject.adapters.credentials.delete());
      expectEqual(await read(subject), { kind: 'missing' }, 'read after delete');
      await attempt('credentials.delete() on an empty store', () =>
        subject.adapters.credentials.delete(),
      );
    },
  },
  conditionCheck(CHECK_ID.CREDENTIALS_LOCKED, 'locked'),
  conditionCheck(CHECK_ID.CREDENTIALS_CANCELLED, 'cancelled'),
  conditionCheck(CHECK_ID.CREDENTIALS_CORRUPT, 'corrupt'),
  conditionCheck(CHECK_ID.CREDENTIALS_UNAVAILABLE, 'unavailable'),
];
