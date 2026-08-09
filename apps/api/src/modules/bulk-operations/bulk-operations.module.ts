import { Module } from '@nestjs/common';
import { BulkOperationsService } from './bulk-operations.service';
import { BulkOperationsController } from './bulk-operations.controller';

@Module({
  providers: [BulkOperationsService],
  controllers: [BulkOperationsController],
  exports: [BulkOperationsService],
})
export class BulkOperationsModule {}
