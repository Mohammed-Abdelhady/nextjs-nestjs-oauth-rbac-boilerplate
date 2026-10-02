// Keep session expirations ahead of MongoDB's real-time TTL monitor.
export const TEST_NOW = new Date('2099-01-01T12:00:00.000Z');

export class FrozenClock {
  current: Date;

  constructor(start: Date) {
    this.current = new Date(start.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(next: Date): void {
    this.current = new Date(next.getTime());
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
