import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { AuditModule } from '../audit/audit.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [AuditModule, ContentModule],
  providers: [SmsService],
  controllers: [SmsController],
  exports: [SmsService],
})
export class SmsModule {}
