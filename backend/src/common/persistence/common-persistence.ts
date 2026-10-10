import { DynamicModule, Provider } from '@nestjs/common';
import { MONGO_COMMON_PROVIDERS } from './mongo/mongo-common-persistence';
import { MONGO_CONNECTION } from './mongo/mongo-connection';

/**
 * The database the application runs on. This file and its siblings named
 * `*-persistence.ts` are the only places outside an adapter folder that say
 * which one: each hands its module the adapter's modules and providers under
 * names that say nothing about a database.
 */
export const STORAGE_CONNECTION_IMPORTS: DynamicModule[] = [MONGO_CONNECTION];

export const COMMON_PERSISTENCE_PROVIDERS: Provider[] = MONGO_COMMON_PROVIDERS;
