import { Injectable, Provider } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { StorageStartup } from '../storage-startup';

/**
 * The schemas declare the indexes, and this adapter builds them before the
 * application serves. It asks the connection for its models, so a model a
 * module registers is covered without being named here. Building an index
 * that is already there changes nothing.
 *
 * Migrations are applied by an operator with `migrate-mongo`. The server has
 * never read their record at start and does not here: it neither applies a
 * migration nor refuses to start over one.
 */
@Injectable()
export class MongoStorageStartup extends StorageStartup {
  constructor(@InjectConnection() private readonly connection: Connection) {
    super();
  }

  async prepare(): Promise<void> {
    await Promise.all(
      this.connection.modelNames().map((name) => this.buildIndexes(name)),
    );
  }

  /** Waits out the build Mongoose started itself, then puts back what is lost. */
  private async buildIndexes(name: string): Promise<void> {
    const model = this.connection.model(name);
    await model.init();
    await model.createIndexes();
  }
}

export const MONGO_STORAGE_STARTUP: Provider = {
  provide: StorageStartup,
  useClass: MongoStorageStartup,
};
