import { Module } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { PricingService } from './pricing.service';
import { PromotionsController } from './promotions.controller';

@Module({
  providers: [PromotionsService, PricingService],
  controllers: [PromotionsController],
  exports: [PricingService, PromotionsService],
})
export class PromotionsModule {}
