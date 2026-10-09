export class FakeTimer {
  private nextId = 0;
  private readonly callbacks = new Map<number, { milliseconds: number; callback: () => void }>();
  readonly scheduled: number[] = [];
  onCancel: ((milliseconds: number) => void) | undefined;
  onSchedule: ((milliseconds: number) => void) | undefined;

  after(milliseconds: number, callback: () => void): () => void {
    const id = this.nextId++;
    this.scheduled.push(milliseconds);
    this.callbacks.set(id, { milliseconds, callback });
    this.onSchedule?.(milliseconds);
    return () => {
      this.callbacks.delete(id);
      this.onCancel?.(milliseconds);
    };
  }

  get pending(): number {
    return this.callbacks.size;
  }

  get pendingDelays(): number[] {
    return [...this.callbacks.values()].map(({ milliseconds }) => milliseconds);
  }

  fireAll(): void {
    const callbacks = [...this.callbacks.values()].map(({ callback }) => callback);
    this.callbacks.clear();
    for (const callback of callbacks) callback();
  }

  fireDelay(milliseconds: number): void {
    const due = [...this.callbacks.entries()].filter(
      ([, item]) => item.milliseconds === milliseconds,
    );
    for (const [id] of due) this.callbacks.delete(id);
    for (const [, item] of due) item.callback();
  }
}
