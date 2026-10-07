import type { AbortSignalPort, CallbackPort, LaunchAddressResult } from '../src';
import type {
  BrowserScript,
  ConformanceAdapters,
  ConformanceDriver,
  ConformanceSubject,
} from '../conformance';
import { FakeTimer } from './fake-timer';
import { sha256 } from './sha256';
import {
  type BrowserResult,
  FakeBrowser,
  FakeCallbacks,
  FakeClock,
  FakeCrypto,
  FakeInstall,
  MemoryCredentials,
} from './support';

const MICROTASK_TURNS = 20;

/** The engine's browser fake, closed by the abort signal as a real session is. */
export class AbortableBrowser extends FakeBrowser {
  isOpen = false;
  private dismiss: (() => void) | undefined;

  script(result: BrowserScript): void {
    if (result.kind !== 'pending') {
      this.results.push(() => result);
      return;
    }
    this.results.push(
      () =>
        new Promise<BrowserResult>((resolve) => {
          this.dismiss = () => resolve({ kind: 'dismissed' });
        }),
    );
  }

  override async open(
    address: string,
    redirectUri: string,
    signal: AbortSignalPort,
  ): Promise<BrowserResult> {
    const onAbort = (): void => this.dismiss?.();
    this.isOpen = true;
    signal.addEventListener('abort', onAbort);
    try {
      return await super.open(address, redirectUri, signal);
    } finally {
      signal.removeEventListener('abort', onAbort);
      this.dismiss = undefined;
      this.isOpen = false;
    }
  }
}

/** The engine's callback fake, handing a launch address over once in total. */
export class LaunchCallbacks extends FakeCallbacks {
  private launchAddress: string | undefined;
  private handed = false;

  constructor(address: string | undefined) {
    super();
    this.initial = address;
    this.launchAddress = address;
  }

  override async initialAddress(): Promise<LaunchAddressResult> {
    const result = await super.initialAddress();
    if (result.kind !== 'unavailable') this.handed = true;
    return result;
  }

  override async deliver(address: string): Promise<void> {
    const repeatsLaunch = address === this.launchAddress;
    this.launchAddress = undefined;
    if (repeatsLaunch && this.handed) return;
    if (repeatsLaunch) {
      this.handed = true;
      this.initial = undefined;
    }
    await super.deliver(address);
  }
}

export interface FakeParts {
  credentials: MemoryCredentials;
  authBrowser: AbortableBrowser;
  crypto: FakeCrypto;
  clock: FakeClock;
  timer: FakeTimer;
  install: FakeInstall;
  /** Lets a test hand the suite a different callbacks adapter for each launch. */
  makeCallbacks: (address: string | undefined) => FakeCallbacks;
  callbacks: FakeCallbacks | undefined;
  /** How many reads of the next launch's address fail before one works. */
  failingLaunchReads: number;
}

export interface FakeSubject extends ConformanceSubject {
  adapters: ConformanceAdapters;
  parts: FakeParts;
}

function timeDriver(parts: FakeParts): ConformanceDriver['time'] & { reset(): void } {
  let now = 0;
  let due: { delay: number; at: number }[] = [];
  parts.timer.onSchedule = (delay) => due.push({ delay, at: now + delay });
  parts.timer.onCancel = (delay) => {
    const index = due.findIndex((item) => item.delay === delay);
    if (index >= 0) due.splice(index, 1);
  };
  return {
    reset() {
      parts.timer.fireAll();
      due = [];
    },
    async elapse(milliseconds) {
      now += milliseconds;
      parts.clock.advance(milliseconds);
      const ready = due.filter((item) => item.at <= now);
      due = due.filter((item) => item.at > now);
      for (const delay of new Set(ready.map((item) => item.delay))) parts.timer.fireDelay(delay);
    },
    async jumpWall(milliseconds) {
      parts.clock.jumpWall(milliseconds);
    },
  };
}

function driverFor(parts: FakeParts): ConformanceDriver {
  const time = timeDriver(parts);
  return {
    async reset() {
      parts.credentials.value = undefined;
      parts.credentials.readResult = undefined;
      parts.credentials.beforeReplace = undefined;
      parts.credentials.writeResult = undefined;
      parts.credentials.discarded = false;
      parts.authBrowser.results.length = 0;
      parts.authBrowser.opened.length = 0;
      parts.install.result = { kind: 'found', id: 'install-1' };
      parts.callbacks = undefined;
      parts.failingLaunchReads = 0;
      time.reset();
    },
    async settle() {
      for (let turn = 0; turn < MICROTASK_TURNS; turn += 1) await Promise.resolve();
    },
    credentials: {
      async force(condition) {
        parts.credentials.readResult = { kind: condition };
      },
      async failNextReplace() {
        parts.credentials.beforeReplace = async () => {
          parts.credentials.beforeReplace = undefined;
          return { kind: 'unavailable' };
        };
      },
      async blockWrites(condition) {
        parts.credentials.writeResult = { kind: condition };
      },
      async discard() {
        parts.credentials.value = undefined;
        parts.credentials.discarded = true;
      },
    },
    authBrowser: {
      async script(result) {
        parts.authBrowser.script(result);
      },
      lastAddress: async () => parts.authBrowser.opened.at(-1)?.address,
      lastRedirectUri: async () => parts.authBrowser.opened.at(-1)?.redirectUri,
      isOpen: async () => parts.authBrowser.isOpen,
    },
    callbacks: {
      async failNextLaunchRead() {
        parts.failingLaunchReads = 1;
      },
      async launch(address): Promise<CallbackPort> {
        parts.callbacks = parts.makeCallbacks(address);
        parts.callbacks.unavailableReads = parts.failingLaunchReads;
        parts.failingLaunchReads = 0;
        return parts.callbacks;
      },
      async deliver(address) {
        await parts.callbacks?.deliver(address);
      },
    },
    time,
    install: {
      async makeUnavailable() {
        parts.install.result = { kind: 'unavailable' };
      },
      async lock() {
        parts.install.result = { kind: 'locked' };
      },
    },
  };
}

/** The engine's own fakes, completed where a port outcome needs a platform behind it. */
export function fakeSubject(): FakeSubject {
  const crypto = new FakeCrypto();
  crypto.hashOverride = sha256;
  const parts: FakeParts = {
    credentials: new MemoryCredentials(),
    authBrowser: new AbortableBrowser(),
    crypto,
    clock: new FakeClock(),
    timer: new FakeTimer(),
    install: new FakeInstall(),
    makeCallbacks: (address) => new LaunchCallbacks(address),
    callbacks: undefined,
    failingLaunchReads: 0,
  };
  const adapters: ConformanceAdapters = {
    credentials: parts.credentials,
    authBrowser: parts.authBrowser,
    crypto: parts.crypto,
    clock: parts.clock,
    timer: parts.timer,
    install: parts.install,
  };
  return { adapters, driver: driverFor(parts), parts };
}
