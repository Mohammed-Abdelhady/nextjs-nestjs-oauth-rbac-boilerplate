import { tmpdir } from 'node:os';
import { basename } from 'node:path';
import { performance } from 'node:perf_hooks';
import { startSharedMongoServer } from '../memory-replset';
import {
  hasSharedMongoRun,
  setSharedMongoRun,
  type SharedMongoServer,
} from './mongo-server-state';
import {
  BACKEND_TEST_MONGO_DATA_PREFIX,
  BACKEND_TEST_MONGO_INSTANCE_COUNT_ENV,
  BACKEND_TEST_MONGO_URIS_ENV,
} from '../../constants/mongo';
import {
  processExists,
  removeOrphanedDataDirectories,
} from '../../run-jest-support.mjs';

const DEFAULT_INSTANCE_COUNT = 1;

export default async function mongoGlobalSetup(): Promise<void> {
  if (hasSharedMongoRun()) {
    throw new Error('The shared Jest MongoDB run is already set up');
  }

  const orphaned = removeOrphanedDataDirectories(
    tmpdir(),
    BACKEND_TEST_MONGO_DATA_PREFIX,
    (pid) => processExists(pid, (candidate) => process.kill(candidate, 0)),
  );
  if (orphaned.length > 0) {
    console.info(`[jest-mongo] removed orphaned data=${orphaned.join(',')}`);
  }

  const previousUris = process.env[BACKEND_TEST_MONGO_URIS_ENV];
  const instanceCount = readInstanceCount();
  const servers: SharedMongoServer[] = [];

  try {
    for (let index = 0; index < instanceCount; index += 1) {
      const startedAt = performance.now();
      const server = await startSharedMongoServer(index);
      servers.push(server);
      const startupMs = Math.round(performance.now() - startedAt);
      console.info(
        `[jest-mongo] started instance=${index + 1}/${instanceCount} pid=${process.pid} port=${server.port} data=${basename(server.dataPath)} startupMs=${startupMs}`,
      );
    }

    setSharedMongoRun(servers, previousUris);
    process.env[BACKEND_TEST_MONGO_URIS_ENV] = JSON.stringify(
      servers.map(({ uri }) => uri),
    );
  } catch (error) {
    for (const server of servers) {
      await server.stop().catch(() => undefined);
    }
    throw error;
  }
}

function readInstanceCount(): number {
  const value = process.env[BACKEND_TEST_MONGO_INSTANCE_COUNT_ENV];
  if (value === undefined) return DEFAULT_INSTANCE_COUNT;

  const count = Number.parseInt(value, 10);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(
      'The Jest MongoDB instance count must be a positive integer',
    );
  }
  return count;
}
