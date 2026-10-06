import { TransportError, TRANSPORT_FAILURE } from '@app/sdk';
import { PortAbortController } from './abort-controller';
import { AuthPortError } from './errors';
import type { AbortSignalPort, TimerPort, Unsubscribe } from './types/auth';

export class PortDeadlineError extends AuthPortError {
  constructor(operation: string) {
    super(operation, 'timedOut');
    this.name = 'PortDeadlineError';
  }
}

export function withNetworkDeadline<T>(
  timer: TimerPort,
  milliseconds: number,
  request: (signal: AbortSignalPort) => Promise<T>,
  onLateSuccess?: (value: T) => void,
): Promise<T> {
  const controller = new PortAbortController();
  let cancel: Unsubscribe = () => undefined;
  let deadlinePassed = false;
  let rejectTimeout: (reason: unknown) => void = () => undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    rejectTimeout = reject;
  });
  try {
    cancel = timer.after(milliseconds, () => {
      deadlinePassed = true;
      controller.abort();
      rejectTimeout(new TransportError(TRANSPORT_FAILURE.NO_RESPONSE));
    });
  } catch (error) {
    controller.abort();
    return Promise.reject(error);
  }
  if (deadlinePassed) {
    return timeout.finally(() => {
      cancelTimer(cancel);
      controller.abort();
    });
  }
  const pending = Promise.resolve().then(() => request(controller.signal));
  if (onLateSuccess) {
    void pending.then(
      (value) => {
        if (deadlinePassed) onLateSuccess(value);
      },
      () => undefined,
    );
  }
  return Promise.race([pending, timeout]).finally(() => {
    cancelTimer(cancel);
    controller.abort();
  });
}

export function withPortDeadline<T>(
  timer: TimerPort,
  milliseconds: number,
  operation: () => Promise<T>,
  operationName: string,
  onTimeout?: () => void,
): Promise<T> {
  let cancel: Unsubscribe = () => undefined;
  let deadlinePassed = false;
  let rejectTimeout: (reason: unknown) => void = () => undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    rejectTimeout = reject;
  });
  try {
    cancel = timer.after(milliseconds, () => {
      deadlinePassed = true;
      onTimeout?.();
      rejectTimeout(new PortDeadlineError(operationName));
    });
  } catch (error) {
    onTimeout?.();
    return Promise.reject(error);
  }
  if (deadlinePassed) return timeout.finally(() => cancelTimer(cancel));
  const pending = Promise.resolve().then(operation);
  return Promise.race([pending, timeout]).finally(() => cancelTimer(cancel));
}

function cancelTimer(cancel: Unsubscribe): void {
  try {
    cancel();
  } catch {
    return;
  }
}
