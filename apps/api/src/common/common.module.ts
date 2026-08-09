import { Global, Module } from '@nestjs/common';
import { BranchAccessService } from './services/branch-access.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { CustomerAuthGuard } from './guards/customer-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Global()
@Module({
  providers: [BranchAccessService, AdminAuthGuard, CustomerAuthGuard, PermissionsGuard],
  exports: [BranchAccessService, AdminAuthGuard, CustomerAuthGuard, PermissionsGuard],
})
export class CommonModule {}
