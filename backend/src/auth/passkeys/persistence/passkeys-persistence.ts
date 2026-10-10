import { DynamicModule, Provider } from '@nestjs/common';
import {
  MONGO_PASSKEY_MODELS,
  MONGO_PASSKEY_PROVIDERS,
} from './mongo/mongo-passkeys-persistence';

/** What PasskeysModule runs on. The one place it names a database. */
export const PASSKEYS_PERSISTENCE_IMPORTS: DynamicModule[] = [
  MONGO_PASSKEY_MODELS,
];

export const PASSKEYS_PERSISTENCE_PROVIDERS: Provider[] =
  MONGO_PASSKEY_PROVIDERS;
