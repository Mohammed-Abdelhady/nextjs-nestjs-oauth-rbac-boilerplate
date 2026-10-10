import { DynamicModule, Provider } from '@nestjs/common';
import {
  MONGO_SEED_MODELS,
  MONGO_SEED_PROVIDERS,
} from './mongo/mongo-seed-persistence';

/** What SeedModule runs on. The one place it names a database. */
export const SEED_PERSISTENCE_IMPORTS: DynamicModule[] = [MONGO_SEED_MODELS];

export const SEED_PERSISTENCE_PROVIDERS: Provider[] = MONGO_SEED_PROVIDERS;
