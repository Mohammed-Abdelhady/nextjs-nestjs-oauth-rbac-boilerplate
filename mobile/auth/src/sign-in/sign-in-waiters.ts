import type { SignInOutcome, Unsubscribe } from '../types/auth';
import type { AuthRuntime } from '../runtime/runtime';
import type { EpochChangeReason } from '../runtime/runtime';

export interface DeferredOutcome {
  promise: Promise<SignInOutcome>;
  resolve(outcome: SignInOutcome): void;
}

export function deferredOutcome(): DeferredOutcome {
  let resolveValue: (outcome: SignInOutcome) => void = () => undefined;
  const promise = new Promise<SignInOutcome>((resolve) => {
    resolveValue = resolve;
  });
  return { promise, resolve: resolveValue };
}

export function waitForEpochChange(runtime: AuthRuntime): {
  promise: Promise<{ kind: 'epochChanged'; reason: EpochChangeReason }>;
  cancel: Unsubscribe;
} {
  let cancel: Unsubscribe = () => undefined;
  const promise = new Promise<{ kind: 'epochChanged'; reason: EpochChangeReason }>((resolve) => {
    cancel = runtime.onEpochChange((reason) => {
      if (reason !== 'sessionEnded') resolve({ kind: 'epochChanged', reason });
    });
  });
  return { promise, cancel };
}
