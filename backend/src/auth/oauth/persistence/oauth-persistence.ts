import { DynamicModule, Provider } from '@nestjs/common';
import {
  MONGO_OAUTH_MODELS,
  MONGO_OAUTH_PROVIDERS,
} from './mongo/mongo-oauth-persistence';

/** What OAuthModule runs on. The one place it names a database. */
export const OAUTH_PERSISTENCE_IMPORTS: DynamicModule[] = [MONGO_OAUTH_MODELS];

export const OAUTH_PERSISTENCE_PROVIDERS: Provider[] = MONGO_OAUTH_PROVIDERS;
