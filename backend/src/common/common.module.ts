import { Module } from '@nestjs/common';
import { HashService } from './services/hash.service';
import { Clock } from './services/clock';
import { AuthEpochService } from './services/auth-epoch.service';
import { IdFormat } from './persistence/id-format';
import { MongoIdFormat } from './persistence/mongo/mongo-id-format';

@Module({
  providers: [
    HashService,
    Clock,
    AuthEpochService,
    { provide: IdFormat, useClass: MongoIdFormat },
  ],
  exports: [HashService, Clock, AuthEpochService, IdFormat],
})
export class CommonModule {}
