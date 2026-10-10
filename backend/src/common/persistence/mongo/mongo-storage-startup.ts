import { Injectable, Provider } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Application } from '../../../session/persistence/mongo/schemas/application.schema';
import { AuthorizationTransaction } from '../../../session/persistence/mongo/schemas/authorization-transaction.schema';
import { BrowserProof } from '../../../session/persistence/mongo/schemas/browser-proof.schema';
import { NativeCredential } from '../../../session/persistence/mongo/schemas/native-credential.schema';
import { NativeDpopProofId } from '../../../session/persistence/mongo/schemas/native-dpop-proof-id.schema';
import { SecurityEvent } from '../../../session/persistence/mongo/schemas/security-event.schema';
import { Session } from '../../../session/persistence/mongo/schemas/session.schema';
import { StepUpChallenge } from '../../../session/persistence/mongo/schemas/step-up-challenge.schema';
import { UserApplicationGrant } from '../../../session/persistence/mongo/schemas/user-application-grant.schema';
import { User } from '../../../user/persistence/mongo/schemas/user.schema';
import { StorageStartup } from '../storage-startup';

/** The collections whose unique rules session authority rests on. */
const SESSION_AUTHORITY_MODELS = [
  Session.name,
  BrowserProof.name,
  NativeDpopProofId.name,
  Application.name,
  UserApplicationGrant.name,
  NativeCredential.name,
  AuthorizationTransaction.name,
  StepUpChallenge.name,
  SecurityEvent.name,
  User.name,
];

/**
 * The schemas declare the indexes, and this adapter builds the ones session
 * authority rests on before the application serves. Building an index that is
 * already there changes nothing.
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
      SESSION_AUTHORITY_MODELS.map((name) =>
        this.connection.model(name).createIndexes(),
      ),
    );
  }
}

export const MONGO_STORAGE_STARTUP: Provider = {
  provide: StorageStartup,
  useClass: MongoStorageStartup,
};
