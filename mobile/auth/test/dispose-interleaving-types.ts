import type { AuthEngine } from '../src';
import type { Deferred } from './support';

export interface SharedStore {
  value: string | undefined;
  owner: string;
}

export interface Audit {
  active: boolean;
  disposed: boolean;
  requestedDispose: boolean;
  calls: string[];
  postDisposeCalls: string[];
  faultOrdinal: number | undefined;
  faultMode: 'fail' | 'late' | undefined;
  faultReady: Deferred<void>;
  faultRelease: Deferred<void> | undefined;
  target: number;
  gap: number;
  disposeGate: Deferred<void>;
  readSinceDispose: boolean;
  unguardedWrites: string[];
  successorWrites: string[];
  issuedTokens: {
    actor: string;
    token: string;
    parent: string | undefined;
    settled: Deferred<void>;
  }[];
  activeTransportActor: string | undefined;
  engine: AuthEngine | undefined;
}

export type Scenario = 'signIn' | 'refresh' | 'signOut';
export type PostDisposeFault = { ordinal: number; mode: 'fail' | 'late' };
