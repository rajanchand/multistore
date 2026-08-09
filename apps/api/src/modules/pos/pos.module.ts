import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [InventoryModule, NotificationsModule],
  providers: [PosService],
  controllers: [PosController],
  exports: [PosService],
})
export class PosModule {}
