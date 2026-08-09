import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { SettingsService } from './settings.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [ContentService, SettingsService],
  controllers: [ContentController],
  exports: [ContentService, SettingsService],
})
export class ContentModule {}
