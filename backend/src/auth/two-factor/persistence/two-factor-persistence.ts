import { Provider } from '@nestjs/common';
import { MONGO_SECOND_FACTOR_SIGN_IN } from './mongo/mongo-second-factor-stores';

/** What TwoFactorModule runs on. The one place it names a database. */
export const TWO_FACTOR_PERSISTENCE_PROVIDERS: Provider[] = [
  MONGO_SECOND_FACTOR_SIGN_IN,
];
