import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StripePaymentProvider } from './stripe.provider';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [InventoryModule, NotificationsModule],
  providers: [
    PaymentsService,
    StripePaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: StripePaymentProvider },
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
