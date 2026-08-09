import { Global, Module } from '@nestjs/common';
import { BranchAccessService } from './services/branch-access.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { CustomerAuthGuard } from './guards/customer-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { CacheService } from './cache/cache.service';
import { RedisThrottlerStorage } from './cache/redis-throttler.storage';

@Global()
@Module({
  providers: [
    BranchAccessService,
    AdminAuthGuard,
    CustomerAuthGuard,
    PermissionsGuard,
    CacheService,
    RedisThrottlerStorage,
  ],
  exports: [
    BranchAccessService,
    AdminAuthGuard,
    CustomerAuthGuard,
    PermissionsGuard,
    CacheService,
    RedisThrottlerStorage,
  ],
})
export class CommonModule {}
