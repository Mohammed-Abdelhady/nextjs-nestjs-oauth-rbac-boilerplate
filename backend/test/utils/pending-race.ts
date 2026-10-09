import type { Model } from 'mongoose';
import type { Response } from 'supertest';
import type { MailOptions } from '../../src/mail/interfaces/mail-options.interface';
import { RaceGate, pauseQuery } from './race-gate';

type QueryMethod =
  'findOneAndUpdate' | 'updateOne' | 'deleteOne' | 'findOneAndDelete';

/**
 * Hold the model call at `callIndex` on its gate. The gate is placed on the
 * query or promise the caller is about to run, so the request is past every
 * earlier step and has not run this one yet.
 */
export function pauseQueryCall<DocType>(
  model: Model<DocType>,
  method: QueryMethod,
  gate: RaceGate,
  callIndex: number,
): () => void {
  const original = model[method].bind(model);
  let call = 0;
  const spy = jest
    .spyOn(model, method)
    .mockImplementation((...args: unknown[]) => {
      const query = Reflect.apply(original, model, args);
      if (call === callIndex) {
        pauseQuery(query as { exec: () => Promise<unknown> }, gate);
      }
      call += 1;
      return query as ReturnType<typeof original>;
    });
  return () => spy.mockRestore();
}

/** Hold the model's `create` at `callIndex` on its gate. */
export function pauseCreateCall<DocType>(
  model: Model<DocType>,
  gate: RaceGate,
  callIndex: number,
): () => void {
  const original = model.create.bind(model);
  let call = 0;
  const spy = jest
    .spyOn(model, 'create')
    .mockImplementation((...args: Parameters<typeof original>) => {
      const run = () => original(...args);
      const current = call;
      call += 1;
      return current === callIndex ? gate.hold().then(run) : run();
    });
  return () => spy.mockRestore();
}

/** The 6-digit code the last captured mail carried. */
export function mailedCode(mail: MailOptions[]): string {
  const last = mail[mail.length - 1];
  const match = /\b(\d{6})\b/.exec(last?.text ?? '');
  if (!match?.[1]) {
    throw new Error('the last mail carried no 6-digit code');
  }
  return match[1];
}

/**
 * Start one request, wait for its gate, run the interference, release, and
 * return the response. The interference is where the record changes under the
 * request's feet; no timers are involved.
 */
export async function inWindow(
  install: (gate: RaceGate) => () => void,
  run: () => Promise<Response>,
  interfere: () => Promise<unknown>,
): Promise<Response> {
  const gate = new RaceGate();
  const restore = install(gate);
  try {
    const response = Promise.resolve(run());
    await gate.reached(1);
    await interfere();
    gate.release();
    return await response;
  } finally {
    restore();
  }
}
