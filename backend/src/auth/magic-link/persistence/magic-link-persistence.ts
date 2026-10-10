import { DynamicModule, Provider } from '@nestjs/common';
import { forStorage } from '../../../common/persistence/storage-choice';
import {
  MONGO_MAGIC_LINK_MODELS,
  MONGO_MAGIC_LINK_PROVIDERS,
} from './mongo/mongo-magic-link-persistence';
import { POSTGRES_MAGIC_LINK_PROVIDERS } from './postgres/postgres-magic-link-persistence'; // feature:postgres

/** What MagicLinkModule runs on. The one place it names a database. */
export const MAGIC_LINK_PERSISTENCE_IMPORTS: DynamicModule[] = forStorage({
  mongodb: () => [MONGO_MAGIC_LINK_MODELS],
  postgres: () => [], // feature:postgres
});

export const MAGIC_LINK_PERSISTENCE_PROVIDERS: Provider[] = forStorage({
  mongodb: () => MONGO_MAGIC_LINK_PROVIDERS,
  postgres: () => POSTGRES_MAGIC_LINK_PROVIDERS, // feature:postgres
});
