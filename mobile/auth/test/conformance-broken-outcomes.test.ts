import { describe } from 'vitest';
import type { CredentialsPort, InstallPort } from '../src';
import { type BrokenAdapter, itCatches } from './conformance-broken';
import { LaunchCallbacks } from './conformance-fakes';
import type { FakeCallbacks, MemoryCredentials } from './support';

const WRITE_CHECKS = [
  'credentials.write-locked',
  'credentials.write-cancelled',
  'credentials.write-unavailable',
];

/** Every check starts by writing a record, except the one that reads an empty store. */
const EVERY_CHECK_THAT_WRITES = [
  'credentials.found',
  'credentials.replace-overwrites',
  'credentials.replace-atomic',
  'credentials.delete',
  'credentials.locked',
  'credentials.cancelled',
  'credentials.corrupt',
  'credentials.unavailable',
  'credentials.discarded',
  ...WRITE_CHECKS,
];

function credentials(
  fault: string,
  fails: string[],
  broken: (inner: MemoryCredentials) => Partial<CredentialsPort>,
): BrokenAdapter {
  return {
    fault,
    fails,
    install(subject) {
      const inner = subject.parts.credentials;
      subject.adapters.credentials = {
        read: () => inner.read(),
        replace: (value) => inner.replace(value),
        delete: () => inner.delete(),
        ...broken(inner),
      };
    },
  };
}

type WriteResult = Awaited<ReturnType<CredentialsPort['replace']>>;

/** Both writes, with one refusal reported as something else. */
function writesAs(change: (result: WriteResult) => WriteResult) {
  return (inner: MemoryCredentials): Partial<CredentialsPort> => ({
    replace: async (value) => change(await inner.replace(value)),
    delete: async () => change(await inner.delete()),
  });
}

function install(
  fault: string,
  identity: (inner: InstallPort) => InstallPort['identity'],
): BrokenAdapter {
  return {
    fault,
    fails: ['install.locked'],
    install(subject) {
      subject.adapters.install = { identity: identity(subject.parts.install) };
    },
  };
}

function launch(fault: string, broken: (port: LaunchCallbacks) => void): BrokenAdapter {
  return {
    fault,
    fails: ['callbacks.launch-unavailable'],
    install(subject) {
      subject.parts.makeCallbacks = (address): FakeCallbacks => {
        const port = new LaunchCallbacks(address);
        broken(port);
        return port;
      };
    },
  };
}

describe('faults in a record the platform discarded', () => {
  itCatches([
    credentials('reads a discarded record as no account', ['credentials.discarded'], (inner) => ({
      read: async () => {
        const result = await inner.read();
        return inner.discarded && result.kind === 'corrupt' ? { kind: 'missing' } : result;
      },
    })),
    credentials(
      'leaves its marker behind after a delete',
      ['credentials.delete', 'credentials.discarded'],
      (inner) => ({
        delete: async () => {
          const result = await inner.delete();
          inner.discarded = true;
          return result;
        },
      }),
    ),
  ]);
});

describe('faults in the result of a write', () => {
  itCatches([
    credentials(
      'reports a locked write as a broken store',
      ['credentials.write-locked'],
      writesAs((result) => (result.kind === 'locked' ? { kind: 'unavailable' } : result)),
    ),
    credentials(
      'reports a dismissed prompt as a locked write',
      ['credentials.write-cancelled'],
      writesAs((result) => (result.kind === 'cancelled' ? { kind: 'locked' } : result)),
    ),
    credentials(
      'rejects when a write is refused',
      ['credentials.replace-atomic', ...WRITE_CHECKS],
      writesAs((result) => {
        if (result.kind !== 'done') throw new Error(`The store is ${result.kind}.`);
        return result;
      }),
    ),
    credentials('reports a refused delete as done', WRITE_CHECKS, (inner) => ({
      delete: async () => {
        await inner.delete();
        return { kind: 'done' };
      },
    })),
    credentials(
      'answers unavailable for a replace that worked',
      EVERY_CHECK_THAT_WRITES,
      (inner) => ({
        replace: async (value) => {
          await inner.replace(value);
          return { kind: 'unavailable' };
        },
      }),
    ),
    // On a store that is cancelled this answer happens to be right, so that check passes.
    credentials(
      'answers cancelled for a delete that worked',
      [
        'credentials.delete',
        'credentials.discarded',
        'credentials.write-locked',
        'credentials.write-unavailable',
      ],
      (inner) => ({
        delete: async () => {
          await inner.delete();
          return { kind: 'cancelled' };
        },
      }),
    ),
  ]);
});

describe('faults in a locked install identity', () => {
  itCatches([
    install('reports locked storage as unreadable', (inner) => async () => {
      const result = await inner.identity();
      return result.kind === 'locked' ? { kind: 'unavailable' } : result;
    }),
    install('throws when storage is locked', (inner) => async () => {
      const result = await inner.identity();
      if (result.kind === 'locked') throw new Error('User interaction is not allowed.');
      return result;
    }),
  ]);
});

describe('faults in a launch address that cannot be read', () => {
  itCatches([
    launch('reads a failed launch read as no link', (port) => {
      const read = port.initialAddress.bind(port);
      port.initialAddress = async () => {
        const result = await read();
        return result.kind === 'unavailable' ? { kind: 'none' } : result;
      };
    }),
    launch('drops the launch address after a failed read', (port) => {
      const read = port.initialAddress.bind(port);
      port.initialAddress = async () => {
        const result = await read();
        if (result.kind === 'unavailable') port.initial = undefined;
        return result;
      };
    }),
    launch('throws when the launch address cannot be read', (port) => {
      const read = port.initialAddress.bind(port);
      port.initialAddress = async () => {
        const result = await read();
        if (result.kind === 'unavailable') throw new Error('The launch address is not ready.');
        return result;
      };
    }),
  ]);
});

describe('faults in the return address', () => {
  itCatches([
    {
      fault: 'waits for its own copy of the return address',
      fails: ['authBrowser.return-address'],
      install(subject) {
        const inner = subject.parts.authBrowser;
        subject.adapters.authBrowser = {
          open: (address, _redirectUri, signal) =>
            inner.open(address, 'sampleapp://other/callback', signal),
        };
      },
    },
  ]);
});
