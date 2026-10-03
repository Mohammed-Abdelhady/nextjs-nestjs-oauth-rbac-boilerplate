import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailDispatcherService } from './mail-dispatcher.service';

@Module({
  providers: [MailService, MailDispatcherService],
  exports: [MailService, MailDispatcherService],
})
export class MailModule {}
