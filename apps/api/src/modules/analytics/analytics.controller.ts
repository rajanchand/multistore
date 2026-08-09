import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { uuidSchema } from '@repo/validation';
import { AnalyticsService } from './analytics.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/auth-context';

const rangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  range: z.enum(['today', 'yesterday', '7d', '30d', 'month', 'year', 'custom']).default('30d'),
  branchIds: z
    .union([z.string(), z.array(uuidSchema)])
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      return Array.isArray(v) ? v : v.split(',').filter(Boolean);
    }),
});

function resolveRange(query: z.infer<typeof rangeSchema>): { from: Date; to: Date } {
  const now = new Date();
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  switch (query.range) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case '7d': {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from, to: endOfDay(now) };
    }
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: endOfDay(now) };
    }
    case 'year': {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from, to: endOfDay(now) };
    }
    case 'custom':
      return {
        from: query.from ?? startOfDay(new Date(now.getTime() - 29 * 86400000)),
        to: query.to ?? endOfDay(now),
      };
    case '30d':
    default: {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { from, to: endOfDay(now) };
    }
  }
}

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequirePermissions('analytics.read')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const { from, to } = resolveRange(query);
    return this.analytics.overview(user, { from, to, branchIds: query.branchIds });
  }

  @Get('revenue-trend')
  revenueTrend(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const { from, to } = resolveRange(query);
    return this.analytics.revenueTrend(user, { from, to, branchIds: query.branchIds });
  }

  @Get('revenue-by-branch')
  revenueByBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const { from, to } = resolveRange(query);
    return this.analytics.revenueByBranch(user, { from, to, branchIds: query.branchIds });
  }

  @Get('top-products')
  topProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const { from, to } = resolveRange(query);
    return this.analytics.topProducts(user, { from, to, branchIds: query.branchIds });
  }

  @Get('sales-by-category')
  salesByCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const { from, to } = resolveRange(query);
    return this.analytics.salesByCategory(user, { from, to, branchIds: query.branchIds });
  }

  @Get('branches')
  branchPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const { from, to } = resolveRange(query);
    return this.analytics.branchPerformance(user, { from, to, branchIds: query.branchIds });
  }

  @Get('payment-methods')
  paymentMethods(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const { from, to } = resolveRange(query);
    return this.analytics.paymentMethodDistribution(user, { from, to, branchIds: query.branchIds });
  }

  /** Dashboard aggregate used by the admin home screen. */
  @Get('dashboard')
  async dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const { from, to } = resolveRange(query);
    const range = { from, to, branchIds: query.branchIds };
    const [overview, revenueTrend, revenueByBranch, topProducts, salesByCategory, branches, paymentMethods] =
      await Promise.all([
        this.analytics.overview(user, range),
        this.analytics.revenueTrend(user, range),
        this.analytics.revenueByBranch(user, range),
        this.analytics.topProducts(user, range),
        this.analytics.salesByCategory(user, range),
        this.analytics.branchPerformance(user, range),
        this.analytics.paymentMethodDistribution(user, range),
      ]);
    return {
      range: { from, to },
      overview,
      revenueTrend,
      revenueByBranch,
      topProducts,
      salesByCategory,
      branches,
      paymentMethods,
    };
  }
}
