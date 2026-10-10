import { DynamicModule, Provider, Type } from '@nestjs/common';
import {
  MONGO_AUTH_BRIDGES,
  MONGO_AUTH_MODELS,
  MONGO_AUTH_PROVIDERS,
} from './mongo/mongo-auth-persistence';

/** What AuthModule runs on. The one place it names a database. */
export const AUTH_PERSISTENCE_IMPORTS: DynamicModule[] = [MONGO_AUTH_MODELS];

export const AUTH_PERSISTENCE_PROVIDERS: Provider[] = MONGO_AUTH_PROVIDERS;

/** What the adapter hands on to modules that import AuthModule. */
export const AUTH_PERSISTENCE_EXPORTS: Type[] = MONGO_AUTH_BRIDGES;
