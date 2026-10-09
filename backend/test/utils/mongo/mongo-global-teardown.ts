import { takeSharedMongoRun } from './mongo-server-state';
import { BACKEND_TEST_MONGO_URIS_ENV } from '../../constants/mongo';

export default async function mongoGlobalTeardown(): Promise<void> {
  const run = takeSharedMongoRun();
  if (!run) return;

  let cleanupError: unknown;
  let hasCleanupError = false;

  try {
    for (const server of run.servers) {
      try {
        await server.stop();
        console.info(`[jest-mongo] stopped port=${server.port}`);
      } catch (error) {
        if (!hasCleanupError) {
          cleanupError = error;
          hasCleanupError = true;
        }
      }
    }
  } finally {
    if (run.previousUris === undefined) {
      delete process.env[BACKEND_TEST_MONGO_URIS_ENV];
    } else {
      process.env[BACKEND_TEST_MONGO_URIS_ENV] = run.previousUris;
    }
  }

  if (hasCleanupError) throw cleanupError;
}
