import { DynamicModule, Provider } from '@nestjs/common';
import {
  MONGO_ADMIN_MODELS,
  MONGO_ADMIN_PROVIDERS,
} from './mongo/mongo-admin-persistence';

/** What AdminModule runs on. The one place it names a database. */
export const ADMIN_PERSISTENCE_IMPORTS: DynamicModule[] = [MONGO_ADMIN_MODELS];

export const ADMIN_PERSISTENCE_PROVIDERS: Provider[] = MONGO_ADMIN_PROVIDERS;
