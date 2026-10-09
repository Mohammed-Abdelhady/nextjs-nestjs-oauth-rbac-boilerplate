import { Module } from '@nestjs/common';
import { HashService } from './services/hash.service';
import { Clock } from './services/clock';
import { AuthEpochService } from './services/auth-epoch.service';

@Module({
  providers: [HashService, Clock, AuthEpochService],
  exports: [HashService, Clock, AuthEpochService],
})
export class CommonModule {}
