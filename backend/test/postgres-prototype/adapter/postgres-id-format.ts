import { IdFormat } from '../../../src/common/persistence/id-format';
import { MalformedIdError } from '../../../src/common/persistence/persistence-errors';
import { toUuid } from './postgres-issuance-mappers';

/** An id is text the stores' own parser reads as a UUID. */
export class PostgresIdFormat extends IdFormat {
  isId(id: string): boolean {
    try {
      toUuid(id);
      return true;
    } catch (error) {
      if (error instanceof MalformedIdError) {
        return false;
      }
      throw error;
    }
  }
}
