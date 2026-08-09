import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { TransfersService } from './transfers.service';
import { InventoryController } from './inventory.controller';

@Module({
  providers: [InventoryService, TransfersService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
