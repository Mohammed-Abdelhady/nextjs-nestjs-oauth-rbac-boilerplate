import { expect, it } from 'vitest';
import { runConformance } from '../conformance';
import { type FakeSubject, fakeSubject } from './conformance-fakes';

export interface BrokenAdapter {
  /** What the adapter gets wrong, in a sentence. */
  fault: string;
  /** Every check this fault must trip, and no other. */
  fails: string[];
  install(subject: FakeSubject): void;
}

/** Runs the suite on otherwise correct fakes with one fault put in. */
export function itCatches(rows: BrokenAdapter[]): void {
  it.each(rows)('catches an adapter that $fault', async ({ fails, install }) => {
    const subject = fakeSubject();
    install(subject);

    const results = await runConformance(subject);

    expect(results.filter((result) => !result.ok).map((result) => result.id)).toEqual(fails);
  });
}
