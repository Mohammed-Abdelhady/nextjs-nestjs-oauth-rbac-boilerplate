import { DynamicModule, Provider } from '@nestjs/common';
import {
  MONGO_MAGIC_LINK_MODELS,
  MONGO_MAGIC_LINK_PROVIDERS,
} from './mongo/mongo-magic-link-persistence';

/** What MagicLinkModule runs on. The one place it names a database. */
export const MAGIC_LINK_PERSISTENCE_IMPORTS: DynamicModule[] = [
  MONGO_MAGIC_LINK_MODELS,
];

export const MAGIC_LINK_PERSISTENCE_PROVIDERS: Provider[] =
  MONGO_MAGIC_LINK_PROVIDERS;
