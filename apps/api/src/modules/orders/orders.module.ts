import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { MyOrdersController, OrdersController, TrackOrderController } from './orders.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [OrdersService],
  controllers: [OrdersController, MyOrdersController, TrackOrderController],
  exports: [OrdersService],
})
export class OrdersModule {}
