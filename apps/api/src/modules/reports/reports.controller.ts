import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  reportKindSchema,
  sendReportSchema,
  uuidSchema,
  type SendReportInput,
} from '@repo/validation';
import { ReportsService } from './reports.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';
import { Errors } from '../../common/errors';

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

function resolveRange(query: {
  from?: Date;
  to?: Date;
  range: 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'year' | 'custom';
}): { from: Date; to: Date } {
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

function ctxOf(req: Request): RequestContext {
  return { requestId: (req as Request & { requestId?: string }).requestId, ip: req.ip };
}

function parseKind(kind: string) {
  const parsed = reportKindSchema.safeParse(kind);
  if (!parsed.success) {
    throw Errors.badRequest('INVALID_REPORT', 'Report kind must be summary, sales, orders, or inventory.');
  }
  return parsed.data;
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
  inventory(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    return this.reports.inventoryReport(user, query.branchIds);
  }

  @Get('recipients')
  recipients(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.recipients(user);
  }

  @Get(':kind/pdf')
  @Header('Content-Type', 'application/pdf')
  async pdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kindParam: string,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    const kind = parseKind(kindParam);
    const { from, to } = resolveRange(query);
    const { buffer, filename } = await this.reports.buildPdf(
      kind,
      user,
      { from, to, branchIds: query.branchIds },
      query.range,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post(':kind/send')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kindParam: string,
    @Body(new ZodValidationPipe(sendReportSchema)) body: SendReportInput,
    @Req() req: Request,
  ) {
    const kind = parseKind(kindParam);
    const rangeKey = body.range ?? '30d';
    const { from, to } = resolveRange({
      range: rangeKey,
      from: body.from,
      to: body.to,
    });
    return this.reports.sendReport(
      kind,
      user,
      { from, to, branchIds: body.branchIds },
      body,
      rangeKey,
      ctxOf(req),
    );
  }
}
