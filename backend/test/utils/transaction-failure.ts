import { Model } from 'mongoose';
import { UserDocument } from '../../src/user/schemas/user.schema';
import { RaceGate } from './race-gate';

/** Fail at the database boundary after the account write, before revocation. */
export function failNextVersionWrite(
  users: Model<UserDocument>,
  error: Error,
  gate?: RaceGate,
): () => void {
  const update = users.collection.updateOne.bind(users.collection);
  let failed = false;
  const spy = jest
    .spyOn(users.collection, 'updateOne')
    .mockImplementation(async (...args: Parameters<typeof update>) => {
      const document = args[1];
      const increment: unknown = Array.isArray(document)
        ? undefined
        : document.$inc;
      if (
        !failed &&
        increment !== null &&
        typeof increment === 'object' &&
        'sessionVersion' in increment
      ) {
        failed = true;
        await gate?.hold();
        throw error;
      }
      return update(...args);
    });
  return () => spy.mockRestore();
}
