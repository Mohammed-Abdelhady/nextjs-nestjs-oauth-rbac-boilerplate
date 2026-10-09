import type {
  AuthBrowserResult,
  AuthPorts,
  CallbackPort,
  CredentialReadResult,
  CredentialWriteResult,
} from '../src';
import type { CHECK_ID } from './constants';

export type ConformanceCheckId = (typeof CHECK_ID)[keyof typeof CHECK_ID];
export type ConformancePort = keyof AuthPorts;

/** The callbacks adapter comes from `driver.callbacks.launch`, one per app start. */
export type ConformanceAdapters = Omit<AuthPorts, 'callbacks'>;

export type CredentialCondition = Exclude<CredentialReadResult['kind'], 'found' | 'missing'>;

/** `pending` keeps the browser session open until something else ends it. */
export type BrowserScript = AuthBrowserResult | { kind: 'pending' };

export type CredentialWriteCondition = Exclude<CredentialWriteResult['kind'], 'done'>;

export interface CredentialsDriver {
  /** Makes every read report this condition until the next reset. */
  force(condition: CredentialCondition): Promise<void>;
  /** Makes the next replace fail part way through the write. */
  failNextReplace(): Promise<void>;
  /** Makes every replace and delete refuse for this reason until the next reset. */
  blockWrites(condition: CredentialWriteCondition): Promise<void>;
  /** Drops the stored record the way a platform does on its own, with no error to read. */
  discard(): Promise<void>;
}

export interface AuthBrowserDriver {
  /** Decides how the next browser session ends. */
  script(result: BrowserScript): Promise<void>;
  /** The address the last session was opened with. */
  lastAddress(): Promise<string | undefined>;
  /** The return address the last session was told to wait for. */
  lastRedirectUri(): Promise<string | undefined>;
  /** Whether the adapter still holds a session. A tab the platform cannot close does not count. */
  isOpen(): Promise<boolean>;
}

export interface CallbacksDriver {
  /** Makes the next start fail to read its launch address once. Later reads work. */
  failNextLaunchRead(): Promise<void>;
  /** Starts the app, optionally from a link, and returns that start's adapter. */
  launch(address: string | undefined): Promise<CallbackPort>;
  /** Hands a link to the running app the way the system does. */
  deliver(address: string): Promise<void>;
}

export interface TimeDriver {
  /** Lets this much time pass for the clock and the timers. */
  elapse(milliseconds: number): Promise<void>;
  /** Moves wall time only, as a person changing the device clock does. */
  jumpWall(milliseconds: number): Promise<void>;
}

export interface InstallDriver {
  /** Makes the install identity unreadable until the next reset. */
  makeUnavailable(): Promise<void>;
  /** Locks the storage behind the install identity until the next reset. */
  lock(): Promise<void>;
}

/** What only a test harness can do to the platform behind the adapters. */
export interface ConformanceDriver {
  /** Returns every port to a clean, working state. Runs before each check. */
  reset(): Promise<void>;
  /** Resolves once work the adapters already started has had time to finish. */
  settle(): Promise<void>;
  credentials: CredentialsDriver;
  authBrowser: AuthBrowserDriver;
  callbacks: CallbacksDriver;
  time: TimeDriver;
  install: InstallDriver;
}

export interface ConformanceSubject {
  adapters: ConformanceAdapters;
  driver: ConformanceDriver;
}

export interface ConformanceCheck {
  id: ConformanceCheckId;
  port: ConformancePort;
  run(subject: ConformanceSubject): Promise<void>;
}

export type ConformanceResult =
  | { id: ConformanceCheckId; port: ConformancePort; ok: true }
  | { id: ConformanceCheckId; port: ConformancePort; ok: false; message: string };
