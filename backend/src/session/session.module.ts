import { Module, OnModuleInit, type INestApplication } from '@nestjs/common';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { CommonModule } from '../common/common.module';
import { UnitOfWorkRunner } from '../common/persistence/unit-of-work';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Application, ApplicationSchema } from './schemas/application.schema';
import {
  AuthorizationTransaction,
  AuthorizationTransactionSchema,
} from './schemas/authorization-transaction.schema';
import {
  NativeCredential,
  NativeCredentialSchema,
} from './schemas/native-credential.schema';
import {
  SecurityEvent,
  SecurityEventSchema,
} from './schemas/security-event.schema';
import {
  BrowserProof,
  BrowserProofSchema,
} from './schemas/browser-proof.schema';
import {
  NativeDpopProofId,
  NativeDpopProofIdSchema,
} from './schemas/native-dpop-proof-id.schema';
import { Session, SessionSchema } from './schemas/session.schema';
import {
  StepUpChallenge,
  StepUpChallengeSchema,
} from './schemas/step-up-challenge.schema';
import {
  UserApplicationGrant,
  UserApplicationGrantSchema,
} from './schemas/user-application-grant.schema';
import { SecurityEventRecorder } from './events/security-event-recorder';
import { SecurityEventStore } from './events/security-event.store';
import { BrowserIssuanceStore } from './issuance/browser-issuance.store';
import { IssuanceApplications } from './issuance/issuance-applications';
import { MongoBrowserIssuanceStore } from './persistence/mongo/mongo-browser-issuance.store';
import { MongoBrowserProofStore } from './persistence/mongo/mongo-browser-proof.store';
import { MongoIssuanceApplications } from './persistence/mongo/mongo-issuance-applications';
import { MongoSecurityEventStore } from './persistence/mongo/mongo-security-event.store';
import { MongoUnitOfWorkRunner } from './persistence/mongo/mongo-unit-of-work';
import { BrowserProofStore } from './proofs/browser-proof.store';
import { BrowserProofService } from './services/browser-proof.service';
import { ApplicationAccessService } from './services/application-access.service';
import { ApplicationRegistryService } from './services/application-registry.service';
import { NativeSessionRevocationService } from './services/native-session-revocation.service';
import { SecurityEventService } from './services/security-event.service';
import { SessionAuthorityService } from './services/session-authority.service';
import { SessionIssuanceService } from './services/session-issuance.service';
import { SessionRevocationService } from './services/session-revocation.service';
import { NativeAccessService } from './native/access/native-access.service';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: BrowserProof.name, schema: BrowserProofSchema },
      { name: NativeDpopProofId.name, schema: NativeDpopProofIdSchema },
      { name: Application.name, schema: ApplicationSchema },
      { name: UserApplicationGrant.name, schema: UserApplicationGrantSchema },
      { name: NativeCredential.name, schema: NativeCredentialSchema },
      {
        name: AuthorizationTransaction.name,
        schema: AuthorizationTransactionSchema,
      },
      { name: StepUpChallenge.name, schema: StepUpChallengeSchema },
      { name: SecurityEvent.name, schema: SecurityEventSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [
    ApplicationAccessService,
    ApplicationRegistryService,
    { provide: BrowserProofStore, useClass: MongoBrowserProofStore },
    BrowserProofService,
    NativeSessionRevocationService,
    { provide: SecurityEventStore, useClass: MongoSecurityEventStore },
    SecurityEventRecorder,
    SecurityEventService,
    { provide: UnitOfWorkRunner, useClass: MongoUnitOfWorkRunner },
    { provide: BrowserIssuanceStore, useClass: MongoBrowserIssuanceStore },
    { provide: IssuanceApplications, useClass: MongoIssuanceApplications },
    SessionIssuanceService,
    SessionAuthorityService,
    SessionRevocationService,
    NativeAccessService,
  ],
  exports: [
    MongooseModule,
    CommonModule,
    ApplicationAccessService,
    ApplicationRegistryService,
    BrowserProofStore,
    BrowserProofService,
    NativeSessionRevocationService,
    SecurityEventStore,
    SecurityEventRecorder,
    SecurityEventService,
    UnitOfWorkRunner,
    BrowserIssuanceStore,
    IssuanceApplications,
    SessionIssuanceService,
    SessionAuthorityService,
    SessionRevocationService,
    NativeAccessService,
  ],
})
export class SessionModule implements OnModuleInit {
  constructor(
    private readonly applications: ApplicationRegistryService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit(): Promise<void> {
    await Promise.all(
      [
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
      ].map((name) => this.connection.model(name).createIndexes()),
    );
    if (process.env.NODE_ENV !== 'production') {
      await this.applications.seedFirstPartyApplications();
    }
    await this.applications.ensureClientOriginAllowed();
  }
}

export async function reconcileStartupApplications(
  app: INestApplication,
): Promise<void> {
  await app.get(ApplicationRegistryService).reconcileNativeApplications();
}
