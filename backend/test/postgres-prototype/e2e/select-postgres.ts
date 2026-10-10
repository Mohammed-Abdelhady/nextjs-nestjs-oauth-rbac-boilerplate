import { useE2eStorage } from '../../utils/e2e-storage';
import { startPostgresE2eStorage } from './e2e-postgres-storage';

/** Every fixture of the PostgreSQL run boots on a database of the shared server. */
useE2eStorage(startPostgresE2eStorage);
