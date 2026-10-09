import type { CredentialWriteResult } from '../src';
import { CHECK_ID, SAMPLE } from './constants';
import { attempt, describeValue, expectEqual, expectTrue } from './expect';
import type {
  ConformanceCheck,
  ConformanceSubject,
  CredentialCondition,
  CredentialWriteCondition,
} from './types';

const DONE: CredentialWriteResult = { kind: 'done' };
const REFUSALS: readonly CredentialWriteResult['kind'][] = ['locked', 'cancelled', 'unavailable'];

const read = ({ adapters }: ConformanceSubject) =>
  attempt('credentials.read()', () => adapters.credentials.read());

const replace = ({ adapters }: ConformanceSubject, value: string) =>
  attempt('credentials.replace()', () => adapters.credentials.replace(value));

const remove = ({ adapters }: ConformanceSubject) =>
  attempt('credentials.delete()', () => adapters.credentials.delete());

async function store(subject: ConformanceSubject, value: string): Promise<void> {
  expectEqual(await replace(subject, value), DONE, 'replace on a working store');
}

/** A blocked read must say why. Reading it as "no account" signs the person out. */
function conditionCheck(
  id: ConformanceCheck['id'],
  condition: CredentialCondition,
): ConformanceCheck {
  return {
    id,
    port: 'credentials',
    async run(subject) {
      await store(subject, SAMPLE.RECORD);
      await subject.driver.credentials.force(condition);
      expectEqual(await read(subject), { kind: condition }, `read of a ${condition} store`);
    },
  };
}

/** A refused write resolves with the reason. The engine decides from it whether to try again. */
function writeConditionCheck(
  id: ConformanceCheck['id'],
  condition: CredentialWriteCondition,
): ConformanceCheck {
  return {
    id,
    port: 'credentials',
    async run(subject) {
      await store(subject, SAMPLE.RECORD);
      await subject.driver.credentials.blockWrites(condition);
      const refused = { kind: condition };
      expectEqual(
        await replace(subject, SAMPLE.NEXT_RECORD),
        refused,
        `replace on a ${condition} store`,
      );
      expectEqual(await remove(subject), refused, `delete on a ${condition} store`);
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
      await store(subject, SAMPLE.RECORD);
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
      await store(subject, SAMPLE.RECORD);
      await store(subject, SAMPLE.NEXT_RECORD);
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
      await store(subject, SAMPLE.NEXT_RECORD);
      await subject.driver.credentials.failNextReplace();
      const refused = await replace(subject, SAMPLE.RECORD);
      expectTrue(
        REFUSALS.includes(refused.kind),
        `a replace that failed to write must report locked, cancelled or unavailable, got ${describeValue(refused)}`,
      );
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
      await store(subject, SAMPLE.RECORD);
      expectEqual(await remove(subject), DONE, 'delete of a stored record');
      expectEqual(await read(subject), { kind: 'missing' }, 'read after delete');
      expectEqual(await remove(subject), DONE, 'delete on an empty store');
    },
  },
  conditionCheck(CHECK_ID.CREDENTIALS_LOCKED, 'locked'),
  conditionCheck(CHECK_ID.CREDENTIALS_CANCELLED, 'cancelled'),
  conditionCheck(CHECK_ID.CREDENTIALS_CORRUPT, 'corrupt'),
  conditionCheck(CHECK_ID.CREDENTIALS_UNAVAILABLE, 'unavailable'),
  {
    // A record that vanished is not "no account": the server's token family is still live.
    id: CHECK_ID.CREDENTIALS_DISCARDED,
    port: 'credentials',
    async run(subject) {
      await store(subject, SAMPLE.RECORD);
      await subject.driver.credentials.discard();
      expectEqual(
        await read(subject),
        { kind: 'corrupt' },
        'read of a record the platform discarded',
      );
      expectEqual(await remove(subject), DONE, 'delete after a discarded record');
      expectEqual(await read(subject), { kind: 'missing' }, 'read after that delete');
    },
  },
  writeConditionCheck(CHECK_ID.CREDENTIALS_WRITE_LOCKED, 'locked'),
  writeConditionCheck(CHECK_ID.CREDENTIALS_WRITE_CANCELLED, 'cancelled'),
  writeConditionCheck(CHECK_ID.CREDENTIALS_WRITE_UNAVAILABLE, 'unavailable'),
];
