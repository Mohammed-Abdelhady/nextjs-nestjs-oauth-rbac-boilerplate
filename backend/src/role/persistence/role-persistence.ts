import { DynamicModule, Provider } from '@nestjs/common';
import {
  MONGO_ROLE_MODELS,
  MONGO_ROLE_PROVIDERS,
} from './mongo/mongo-role-persistence';

/** What RoleModule runs on. The one place it names a database. */
export const ROLE_PERSISTENCE_IMPORTS: DynamicModule[] = [MONGO_ROLE_MODELS];

export const ROLE_PERSISTENCE_PROVIDERS: Provider[] = MONGO_ROLE_PROVIDERS;
