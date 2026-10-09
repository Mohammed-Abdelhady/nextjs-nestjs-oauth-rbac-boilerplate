import type { Unsubscribe } from '../types/auth';

export class DisposeListeners {
  private readonly listeners = new Set<() => void>();
  private disposed = false;

  get size(): number {
    return this.listeners.size;
  }

  subscribe(listener: () => void): Unsubscribe {
    if (this.disposed) {
      invoke(listener);
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  race<T, R>(pending: Promise<T>, disposedResult: () => R): Promise<T | R> {
    return new Promise<T | R>((resolve, reject) => {
      let settled = false;
      let unsubscribe = (): void => undefined;
      const finish = (action: () => void): void => {
        if (settled) return;
        settled = true;
        unsubscribe();
        action();
      };
      unsubscribe = this.subscribe(() => {
        let result: R;
        try {
          result = disposedResult();
        } catch (error) {
          finish(() => reject(error));
          return;
        }
        finish(() => resolve(result));
      });
      void pending.then(
        (value) => finish(() => resolve(value)),
        (error: unknown) => finish(() => reject(error)),
      );
    });
  }

  notify(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const listener of this.listeners) invoke(listener);
    this.listeners.clear();
  }
}

function invoke(listener: () => void): void {
  try {
    listener();
  } catch {
    return;
  }
}
