import { DynamicModule, Provider } from '@nestjs/common';
import { forStorage } from '../../common/persistence/storage-choice';
import {
  MONGO_ADMIN_MODELS,
  MONGO_ADMIN_PROVIDERS,
} from './mongo/mongo-admin-persistence';
import { POSTGRES_ADMIN_PROVIDERS } from './postgres/postgres-admin-persistence'; // feature:postgres

/** What AdminModule runs on. The one place it names a database. */
export const ADMIN_PERSISTENCE_IMPORTS: DynamicModule[] = forStorage({
  mongodb: () => [MONGO_ADMIN_MODELS],
  postgres: () => [], // feature:postgres
});

export const ADMIN_PERSISTENCE_PROVIDERS: Provider[] = forStorage({
  mongodb: () => MONGO_ADMIN_PROVIDERS,
  postgres: () => POSTGRES_ADMIN_PROVIDERS, // feature:postgres
});
