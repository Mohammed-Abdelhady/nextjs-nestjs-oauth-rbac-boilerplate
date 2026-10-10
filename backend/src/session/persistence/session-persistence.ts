import { DynamicModule, Provider, Type } from '@nestjs/common';
import { forStorage } from '../../common/persistence/storage-choice';
import {
  MONGO_SESSION_BRIDGES,
  MONGO_SESSION_MODELS,
  MONGO_SESSION_PROVIDERS,
} from './mongo/mongo-session-persistence';
import { POSTGRES_SESSION_PROVIDERS } from './postgres/postgres-session-persistence'; // feature:postgres

/** What SessionModule runs on. The one place it names a database. */
export const SESSION_PERSISTENCE_IMPORTS: DynamicModule[] = forStorage({
  mongodb: () => [MONGO_SESSION_MODELS],
  postgres: () => [], // feature:postgres
});

export const SESSION_PERSISTENCE_PROVIDERS: Provider[] = forStorage({
  mongodb: () => MONGO_SESSION_PROVIDERS,
  postgres: () => POSTGRES_SESSION_PROVIDERS, // feature:postgres
});

/** What the adapter hands on to modules that import SessionModule. */
export const SESSION_PERSISTENCE_EXPORTS: Array<DynamicModule | Type> =
  forStorage({
    mongodb: () => [MONGO_SESSION_MODELS, ...MONGO_SESSION_BRIDGES],
    postgres: () => [], // feature:postgres
  });
