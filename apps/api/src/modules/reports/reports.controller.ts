import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { uuidSchema } from '@repo/validation';
import { ReportsService } from './reports.service';
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

@ApiTags('reports')
@Controller('reports')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequirePermissions('report.read')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const { from, to } = resolveRange(query);
    return this.reports.hqSummary(user, { from, to, branchIds: query.branchIds });
  }

  @Get('sales')
  sales(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const { from, to } = resolveRange(query);
    return this.reports.salesReport(user, { from, to, branchIds: query.branchIds });
  }

  @Get('orders')
  orders(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const { from, to } = resolveRange(query);
    return this.reports.ordersReport(user, { from, to, branchIds: query.branchIds });
  }

  @Get('inventory')
  inventory(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.inventoryReport(user);
  }
}
