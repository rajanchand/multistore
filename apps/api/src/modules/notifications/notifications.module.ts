import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsWorker } from './notifications.worker';
import { NotificationsController } from './notifications.controller';

@Module({
  providers: [NotificationsService, NotificationsWorker],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
