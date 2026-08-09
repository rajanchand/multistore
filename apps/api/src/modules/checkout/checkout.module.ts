import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { ReservationExpiryWorker } from './reservation-expiry.worker';
import { CartsModule } from '../carts/carts.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [CartsModule, InventoryModule, PaymentsModule, NotificationsModule, PromotionsModule],
  providers: [CheckoutService, ReservationExpiryWorker],
  controllers: [CheckoutController],
  exports: [CheckoutService],
})
export class CheckoutModule {}
