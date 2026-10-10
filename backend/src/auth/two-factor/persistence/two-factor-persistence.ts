import { Provider } from '@nestjs/common';
import { forStorage } from '../../../common/persistence/storage-choice';
import { MONGO_SECOND_FACTOR_SIGN_IN } from './mongo/mongo-second-factor-stores';
import { POSTGRES_SECOND_FACTOR_SIGN_IN } from './postgres/postgres-second-factor-stores'; // feature:postgres

/** What TwoFactorModule runs on. The one place it names a database. */
export const TWO_FACTOR_PERSISTENCE_PROVIDERS: Provider[] = forStorage({
  mongodb: () => [MONGO_SECOND_FACTOR_SIGN_IN],
  postgres: () => [POSTGRES_SECOND_FACTOR_SIGN_IN], // feature:postgres
});
