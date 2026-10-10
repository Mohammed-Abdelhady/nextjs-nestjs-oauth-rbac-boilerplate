import { DynamicModule, Provider } from '@nestjs/common';
import {
  MONGO_USER_MODELS,
  MONGO_USER_PROVIDERS,
} from './mongo/mongo-user-persistence';

/** What UserModule runs on. The one place it names a database. */
export const USER_PERSISTENCE_IMPORTS: DynamicModule[] = [MONGO_USER_MODELS];

export const USER_PERSISTENCE_PROVIDERS: Provider[] = MONGO_USER_PROVIDERS;
