import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { RedisThrottlerStorage } from './common/cache/redis-throttler.storage';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { BranchesModule } from './modules/branches/branches.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { CartsModule } from './modules/carts/carts.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { OrdersModule } from './modules/orders/orders.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { UsersModule } from './modules/users/users.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BannersModule } from './modules/banners/banners.module';
import { BulkOperationsModule } from './modules/bulk-operations/bulk-operations.module';
import { SearchModule } from './modules/search/search.module';
import { ContentModule } from './modules/content/content.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { SmsModule } from './modules/sms/sms.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PosModule } from './modules/pos/pos.module';

@Module({
  imports: [
    RedisModule,
    CommonModule,
    ThrottlerModule.forRootAsync({
      imports: [CommonModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage,
      }),
    }),
    PrismaModule,
    SessionsModule,
    AuthModule,
    HealthModule,
    AuditModule,
    BranchesModule,
    ProductsModule,
    InventoryModule,
    PromotionsModule,
    StorefrontModule,
    CartsModule,
    PaymentsModule,
    NotificationsModule,
    CheckoutModule,
    OrdersModule,
    RefundsModule,
    UsersModule,
    AnalyticsModule,
    BannersModule,
    BulkOperationsModule,
    SearchModule,
    ContentModule,
    CampaignsModule,
    SmsModule,
    ReportsModule,
    PosModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
