import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AnalyticsModule, AuditModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
