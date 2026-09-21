import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
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
import { Session, SessionSchema } from './schemas/session.schema';
import {
  StepUpChallenge,
  StepUpChallengeSchema,
} from './schemas/step-up-challenge.schema';
import {
  UserApplicationGrant,
  UserApplicationGrantSchema,
} from './schemas/user-application-grant.schema';
import { ApplicationAccessService } from './services/application-access.service';
import { ApplicationRegistryService } from './services/application-registry.service';
import { SecurityEventService } from './services/security-event.service';
import { SessionAuthorityService } from './services/session-authority.service';
import { SessionIssuanceService } from './services/session-issuance.service';
import { SessionRevocationService } from './services/session-revocation.service';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
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
    SecurityEventService,
    SessionIssuanceService,
    SessionAuthorityService,
    SessionRevocationService,
  ],
  exports: [
    MongooseModule,
    CommonModule,
    ApplicationAccessService,
    ApplicationRegistryService,
    SecurityEventService,
    SessionIssuanceService,
    SessionAuthorityService,
    SessionRevocationService,
  ],
})
export class SessionModule implements OnModuleInit {
  constructor(private readonly applications: ApplicationRegistryService) {}

  async onModuleInit(): Promise<void> {
    const environment = process.env.NODE_ENV;
    if (environment === 'production') {
      return;
    }
    await this.applications.seedFirstPartyApplications();
  }
}
