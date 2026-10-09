import type { AbortSignalPort } from '@app/native-auth';

/** The engine's abort signal shape, with a count of the listeners still attached. */
export class TestAbort {
  private readonly listeners = new Set<() => void>();
  private isAborted = false;

  readonly signal: AbortSignalPort;

  constructor() {
    const read = (): boolean => this.isAborted;
    this.signal = {
      get aborted() {
        return read();
      },
      addEventListener: (_type, listener) => void this.listeners.add(listener),
      removeEventListener: (_type, listener) => void this.listeners.delete(listener),
    };
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  abort(): void {
    if (this.isAborted) return;
    this.isAborted = true;
    for (const listener of [...this.listeners]) listener();
  }
}
