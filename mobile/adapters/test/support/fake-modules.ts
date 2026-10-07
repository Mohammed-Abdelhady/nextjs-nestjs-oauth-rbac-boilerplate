import type {
  ClockApi,
  CryptoApi,
  LinkingApi,
  RecordMarkerApi,
  TimerApi,
  UuidApi,
  WebBrowserApi,
  WebBrowserSessionResult,
} from '../../src/types/modules';
import { FakeCodedError } from './fake-store';

export type BrowserStep =
  | { kind: 'resolve'; result: WebBrowserSessionResult }
  | { kind: 'reject'; error: unknown }
  | { kind: 'pending' };

export interface BrowserOpen {
  url: string;
  redirectUrl: string | null | undefined;
  options: { preferEphemeralSession?: boolean } | undefined;
}

/** `expo-web-browser` on iOS: one session at a time, closed by `dismissAuthSession`. */
export class FakeWebBrowser implements WebBrowserApi {
  readonly steps: BrowserStep[] = [];
  readonly opened: BrowserOpen[] = [];
  dismissals = 0;
  isOpen = false;
  /** Lets a test answer from the address the engine built. */
  respond: ((url: string) => WebBrowserSessionResult) | undefined;
  private close: ((result: WebBrowserSessionResult) => void) | undefined;

  reset(): void {
    this.close?.({ type: 'dismiss' });
    this.steps.length = 0;
    this.opened.length = 0;
    this.dismissals = 0;
    this.respond = undefined;
  }

  async openAuthSessionAsync(
    url: string,
    redirectUrl?: string | null,
    options?: { preferEphemeralSession?: boolean },
  ): Promise<WebBrowserSessionResult> {
    if (this.isOpen) {
      throw new FakeCodedError(
        'ERR_WEB_BROWSER_ALREADY_OPEN',
        'Another web browser is already open',
      );
    }
    this.opened.push({ url, redirectUrl, options });
    if (this.respond) return this.respond(url);
    const step = this.steps.shift() ?? { kind: 'pending' };
    if (step.kind === 'resolve') return step.result;
    if (step.kind === 'reject') throw step.error;
    this.isOpen = true;
    return new Promise<WebBrowserSessionResult>((resolve) => {
      this.close = (result) => {
        this.isOpen = false;
        this.close = undefined;
        resolve(result);
      };
    });
  }

  dismissAuthSession(): void {
    this.dismissals += 1;
    this.close?.({ type: 'dismiss' });
  }
}

interface SubtleHost {
  subtle: { digest(algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> };
}

function isSubtleHost(value: unknown): value is SubtleHost {
  return typeof value === 'object' && value !== null && 'subtle' in value;
}

function nodeCrypto(): SubtleHost {
  const host: unknown = Reflect.get(globalThis, 'crypto');
  if (!isSubtleHost(host)) throw new Error('This runtime has no WebCrypto.');
  return host;
}

export const FAKE_SHA256 = 'SHA-256';

/**
 * `expo-crypto`: a seeded byte source, and a digest that reads the whole
 * buffer behind the view it is given, as a native reader of raw memory would.
 */
export class FakeCrypto implements CryptoApi<string> {
  private seed = 1;

  async getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
    const bytes = new Uint8Array(byteCount);
    for (let index = 0; index < byteCount; index += 1) {
      this.seed = (this.seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      bytes[index] = this.seed % 256;
    }
    return bytes;
  }

  digest(algorithm: string, data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
    if (algorithm !== FAKE_SHA256) return Promise.reject(new TypeError('Invalid algorithm'));
    return nodeCrypto().subtle.digest(FAKE_SHA256, data.buffer);
  }
}

/** `expo-linking`: the launch address, and link events to whoever listens. */
export class FakeLinking implements LinkingApi {
  private readonly handlers = new Set<(event: { url: string }) => void>();
  initialReads = 0;
  failInitial = false;
  /** This many reads fail before one works. */
  failingInitialReads = 0;

  constructor(private readonly launchAddress: string | null) {}

  get listenerCount(): number {
    return this.handlers.size;
  }

  async getInitialURL(): Promise<string | null> {
    this.initialReads += 1;
    const failsOnce = this.failingInitialReads > 0;
    if (failsOnce) this.failingInitialReads -= 1;
    if (this.failInitial || failsOnce) throw new Error('The launch address could not be read.');
    return this.launchAddress;
  }

  addEventListener(_type: 'url', handler: (event: { url: string }) => void): { remove(): void } {
    this.handlers.add(handler);
    return { remove: () => void this.handlers.delete(handler) };
  }

  emit(url: string): void {
    for (const handler of [...this.handlers]) handler({ url });
  }
}

/** An `expo-file-system` file: gone after a reinstall, refuses to be created twice. */
export class FakeMarkerFile implements RecordMarkerApi {
  present = false;
  unreadable = false;
  /** The file system refuses to create or delete the file. */
  readOnly = false;

  get exists(): boolean {
    if (this.unreadable) throw new Error('The file system is not available.');
    return this.present;
  }

  create(): void {
    if (this.readOnly) throw new Error('The file system is read-only.');
    if (this.present) throw new Error('The file already exists.');
    this.present = true;
  }

  delete(): void {
    if (this.readOnly) throw new Error('The file system is read-only.');
    if (!this.present) throw new Error('The file does not exist.');
    this.present = false;
  }
}

export class FakeUuid implements UuidApi {
  private next = 1;

  randomUUID(): string {
    const id = `00000000-0000-4000-8000-${String(this.next).padStart(12, '0')}`;
    this.next += 1;
    return id;
  }
}

/** 2027-01-15 in milliseconds. */
export const FAKE_WALL_START = 1_800_000_000_000;

/** `Date`, `performance` and the timer globals over one hand-moved clock. */
export class FakeTime implements ClockApi, TimerApi<number> {
  elapsed = 0;
  wallOffset = 0;
  private nextHandle = 1;
  private readonly timers = new Map<number, { at: number; handler: () => void }>();

  readonly date = { now: (): number => FAKE_WALL_START + this.elapsed + this.wallOffset };
  readonly performance = { now: (): number => this.elapsed };

  get pendingTimers(): number {
    return this.timers.size;
  }

  setTimeout(handler: () => void, milliseconds: number): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.timers.set(handle, { at: this.elapsed + milliseconds, handler });
    return handle;
  }

  clearTimeout(handle: number): void {
    this.timers.delete(handle);
  }

  advance(milliseconds: number): void {
    this.elapsed += milliseconds;
    const due = [...this.timers.entries()]
      .filter(([, timer]) => timer.at <= this.elapsed)
      .sort(([, first], [, second]) => first.at - second.at);
    for (const [handle, timer] of due) {
      if (!this.timers.delete(handle)) continue;
      timer.handler();
    }
  }

  reset(): void {
    this.timers.clear();
    this.wallOffset = 0;
  }
}
