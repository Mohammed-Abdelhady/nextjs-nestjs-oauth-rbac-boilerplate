import { Provider } from '@nestjs/common';
import { MONGO_NATIVE_OAUTH_PROVIDERS } from './mongo/mongo-native-oauth-persistence';

/** What NativeOAuthModule runs on. The one place it names a database. */
export const NATIVE_OAUTH_PERSISTENCE_PROVIDERS: Provider[] =
  MONGO_NATIVE_OAUTH_PROVIDERS;
