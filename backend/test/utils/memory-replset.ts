import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Db } from 'mongodb';

export interface MemoryReplSet {
  uri: (dbName?: string) => string;
  stop: () => Promise<void>;
}

export async function startMemoryReplSet(): Promise<MemoryReplSet> {
  const mongo = await MongoMemoryServer.create({
    instance: {
      ip: '127.0.0.1',
      storageEngine: 'wiredTiger',
      args: ['--replSet', 'rs0'],
    },
  });

  try {
    const baseUri = mongo.getUri();
    const host = new URL(baseUri).host;
    const setupUri = new URL(baseUri);
    setupUri.searchParams.set('directConnection', 'true');
    const setup = await mongoose
      .createConnection(setupUri.toString(), {
        serverSelectionTimeoutMS: 5000,
      })
      .asPromise();
    const db = setup.db;
    if (!db) {
      await setup.close();
      throw new Error('replica set setup has no database handle');
    }
    try {
      await db.admin().command({
        replSetInitiate: {
          _id: 'rs0',
          members: [{ _id: 0, host }],
        },
      });
      await waitForPrimary(db);
    } finally {
      await setup.close();
    }

    const readyUri = new URL(mongo.getUri());
    readyUri.searchParams.set('replicaSet', 'rs0');
    await waitForCommittedTransaction(readyUri.toString());

    return {
      uri: (dbName?: string) => {
        const withDb = dbName ? mongo.getUri(dbName) : mongo.getUri();
        const parsed = new URL(withDb);
        parsed.searchParams.set('replicaSet', 'rs0');
        return parsed.toString();
      },
      stop: async () => {
        await mongo.stop();
      },
    };
  } catch (error) {
    await mongo.stop();
    throw error;
  }
}

async function waitForPrimary(db: Db): Promise<void> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const hello = await db.admin().command({ hello: 1 });
    if (hello.isWritablePrimary === true || hello.ismaster === true) {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw new Error('replica set did not become primary');
}

async function waitForCommittedTransaction(uri: string): Promise<void> {
  const connection = await mongoose
    .createConnection(uri, { serverSelectionTimeoutMS: 5000 })
    .asPromise();
  const deadline = Date.now() + 20000;
  let lastError: unknown;
  try {
    while (Date.now() < deadline) {
      const session = await connection.startSession();
      try {
        session.startTransaction({ writeConcern: { w: 'majority' } });
        await connection
          .collection('replset_probe')
          .insertOne({ at: new Date() }, { session });
        await session.commitTransaction();
        return;
      } catch (error) {
        lastError = error;
        if (session.inTransaction()) {
          try {
            await session.abortTransaction();
          } catch (abortError) {
            // The insert error is the one to retry. Abort can fail after the server already ended the attempt.
            if (!(error instanceof Error) && abortError instanceof Error) {
              lastError = abortError;
            }
          }
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 100);
        });
      } finally {
        await session.endSession();
      }
    }
    const detail =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`replica set cannot commit a transaction: ${detail}`);
  } finally {
    await connection.close();
  }
}
