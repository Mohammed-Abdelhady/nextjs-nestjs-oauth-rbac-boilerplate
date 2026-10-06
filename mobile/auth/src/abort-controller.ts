import type { AbortSignalPort } from './types/auth';

export class PortAbortController {
  private readonly state = { aborted: false, listeners: new Set<() => void>() };

  readonly signal: AbortSignalPort;

  constructor() {
    const state = this.state;
    this.signal = {
      get aborted() {
        return state.aborted;
      },
      addEventListener: (_type, listener) => state.listeners.add(listener),
      removeEventListener: (_type, listener) => state.listeners.delete(listener),
    };
  }

  abort(): void {
    if (this.state.aborted) return;
    this.state.aborted = true;
    for (const listener of [...this.state.listeners]) {
      try {
        listener();
      } catch {
        continue;
      }
    }
    this.state.listeners.clear();
  }
}
