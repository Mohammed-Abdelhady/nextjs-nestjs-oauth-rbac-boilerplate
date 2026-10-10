import { DynamicModule, Provider } from '@nestjs/common';
import { forStorage } from '../../common/persistence/storage-choice';
import {
  MONGO_ROLE_MODELS,
  MONGO_ROLE_PROVIDERS,
} from './mongo/mongo-role-persistence';
import { POSTGRES_ROLE_PROVIDERS } from './postgres/postgres-role-persistence'; // feature:postgres

/** What RoleModule runs on. The one place it names a database. */
export const ROLE_PERSISTENCE_IMPORTS: DynamicModule[] = forStorage({
  mongodb: () => [MONGO_ROLE_MODELS],
  postgres: () => [], // feature:postgres
});

export const ROLE_PERSISTENCE_PROVIDERS: Provider[] = forStorage({
  mongodb: () => MONGO_ROLE_PROVIDERS,
  postgres: () => POSTGRES_ROLE_PROVIDERS, // feature:postgres
});
