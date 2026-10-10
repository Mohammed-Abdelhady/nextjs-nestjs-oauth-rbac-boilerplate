import { DynamicModule, Provider } from '@nestjs/common';
import { forStorage } from '../../common/persistence/storage-choice';
import {
  MONGO_USER_MODELS,
  MONGO_USER_PROVIDERS,
} from './mongo/mongo-user-persistence';
import { POSTGRES_USER_PROVIDERS } from './postgres/postgres-user-persistence'; // feature:postgres

/** What UserModule runs on. The one place it names a database. */
export const USER_PERSISTENCE_IMPORTS: DynamicModule[] = forStorage({
  mongodb: () => [MONGO_USER_MODELS],
  postgres: () => [], // feature:postgres
});

export const USER_PERSISTENCE_PROVIDERS: Provider[] = forStorage({
  mongodb: () => MONGO_USER_PROVIDERS,
  postgres: () => POSTGRES_USER_PROVIDERS, // feature:postgres
});
