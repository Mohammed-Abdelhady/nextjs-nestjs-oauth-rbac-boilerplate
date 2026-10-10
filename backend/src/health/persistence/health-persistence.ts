import { Provider } from '@nestjs/common';
import { MONGO_STORE_HEALTH } from './mongo/mongo-store-health';

/** What HealthModule runs on. The one place it names a database. */
export const HEALTH_PERSISTENCE_PROVIDERS: Provider[] = [MONGO_STORE_HEALTH];
