import { DynamicModule, Provider, Type } from '@nestjs/common';
import { CommonModule } from '../../../common/common.module'; // feature:postgres
import { forStorage } from '../../../common/persistence/storage-choice';
import {
  MONGO_OAUTH_MODELS,
  MONGO_OAUTH_PROVIDERS,
} from './mongo/mongo-oauth-persistence';
import { POSTGRES_OAUTH_PROVIDERS } from './postgres/postgres-oauth-persistence'; // feature:postgres

/** What OAuthModule runs on. The one place it names a database. */
export const OAUTH_PERSISTENCE_IMPORTS: Array<DynamicModule | Type> =
  forStorage<Array<DynamicModule | Type>>({
    mongodb: () => [MONGO_OAUTH_MODELS],
    // feature:postgres:start
    // The clock its store stamps rows with.
    postgres: () => [CommonModule],
    // feature:postgres:end
  });

export const OAUTH_PERSISTENCE_PROVIDERS: Provider[] = forStorage({
  mongodb: () => MONGO_OAUTH_PROVIDERS,
  postgres: () => POSTGRES_OAUTH_PROVIDERS, // feature:postgres
});
