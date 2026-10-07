import { CHECK_ID } from './constants';
import { attempt, describeValue, expectEqual, expectTrue } from './expect';
import type { ConformanceCheck, ConformanceSubject } from './types';

const identity = ({ adapters }: ConformanceSubject) =>
  attempt('install.identity()', () => adapters.install.identity());

export const INSTALL_CHECKS: readonly ConformanceCheck[] = [
  {
    id: CHECK_ID.INSTALL_FOUND,
    port: 'install',
    async run(subject) {
      const first = await identity(subject);
      expectTrue(
        first.kind === 'found' && typeof first.id === 'string' && first.id.length > 0,
        `install identity must be found with a non-empty id, got ${describeValue(first)}`,
      );
      expectEqual(await identity(subject), first, 'install identity on a second read');
    },
  },
  {
    id: CHECK_ID.INSTALL_UNAVAILABLE,
    port: 'install',
    async run(subject) {
      await subject.driver.install.makeUnavailable();
      expectEqual(await identity(subject), { kind: 'unavailable' }, 'unreadable install identity');
    },
  },
];
