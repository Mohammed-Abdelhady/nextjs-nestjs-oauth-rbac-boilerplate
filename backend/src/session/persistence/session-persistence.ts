import { DynamicModule, Provider, Type } from '@nestjs/common';
import {
  MONGO_SESSION_BRIDGES,
  MONGO_SESSION_MODELS,
  MONGO_SESSION_PROVIDERS,
} from './mongo/mongo-session-persistence';

/** What SessionModule runs on. The one place it names a database. */
export const SESSION_PERSISTENCE_IMPORTS: DynamicModule[] = [
  MONGO_SESSION_MODELS,
];

export const SESSION_PERSISTENCE_PROVIDERS: Provider[] =
  MONGO_SESSION_PROVIDERS;

/** What the adapter hands on to modules that import SessionModule. */
export const SESSION_PERSISTENCE_EXPORTS: Array<DynamicModule | Type> = [
  MONGO_SESSION_MODELS,
  ...MONGO_SESSION_BRIDGES,
];
