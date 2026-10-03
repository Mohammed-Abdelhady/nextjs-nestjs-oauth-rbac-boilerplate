/**
 * Test-only rendezvous for forcing a specific interleaving.
 *
 * `RaceGate.hold()` blocks every caller that reaches the gate until `release()`
 * is called; `reached(n)` resolves once `n` callers are held. There are no
 * timers, sleeps or retries, so a test that names an interleaving gets exactly
 * that interleaving on every run.
 *
 * `RaceBarrier` groups gates by a name so a spec can keep its named pause points
 * apart. Neither class imports or reaches into Mongoose; the pause is placed at
 * a seam the spec holds (a spied collaborator or a paused model query).
 */
export class RaceGate {
  private held = 0;
  private open = false;
  private readonly waiting: Array<() => void> = [];
  private arrivals: Array<{ count: number; resolve: () => void }> = [];

  async hold(): Promise<void> {
    if (this.open) {
      return;
    }
    this.held += 1;
    this.settleArrivals();
    await new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  reached(count = 1): Promise<void> {
    if (this.held >= count) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.arrivals.push({ count, resolve });
    });
  }

  release(): void {
    this.open = true;
    for (const resolve of this.waiting.splice(0)) {
      resolve();
    }
  }

  private settleArrivals(): void {
    const remaining: typeof this.arrivals = [];
    for (const arrival of this.arrivals) {
      if (this.held >= arrival.count) {
        arrival.resolve();
      } else {
        remaining.push(arrival);
      }
    }
    this.arrivals = remaining;
  }
}

export class RaceBarrier {
  private readonly gates = new Map<string, RaceGate>();

  point(name: string): RaceGate {
    const existing = this.gates.get(name);
    if (existing) {
      return existing;
    }
    const gate = new RaceGate();
    this.gates.set(name, gate);
    return gate;
  }

  release(name: string): void {
    this.point(name).release();
  }
}

/**
 * Pauses a model query at its public `exec()` call: the spec spies a model
 * method (for example `updateOne`) and hands the returned query here. The write
 * does not reach the database until the gate opens, which is what forces two
 * racers to attempt the same guarded write from the same pre-spend state.
 */
export function pauseQuery<Result>(
  query: { exec: () => Promise<Result> },
  gate: RaceGate,
): void {
  const execute = query.exec.bind(query);
  jest.spyOn(query, 'exec').mockImplementation(async () => {
    await gate.hold();
    return execute();
  });
}
