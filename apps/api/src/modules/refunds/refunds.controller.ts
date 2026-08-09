import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { createRefundSchema, paginationSchema, type CreateRefundInput } from '@repo/validation';
import { RefundsService } from './refunds.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

const refundListSchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'APPROVED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REJECTED']).optional(),
});

const approveSchema = z.object({ restock: z.boolean().default(false) });

function ctxOf(req: Request): RequestContext {
  return { requestId: (req as Request & { requestId?: string }).requestId, ip: req.ip };
}

@ApiTags('refunds')
@Controller('refunds')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Get()
  @RequirePermissions('payment.read')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(refundListSchema)) query: z.infer<typeof refundListSchema>,
  ) {
    return this.refunds.list(user, query);
  }

  @Post()
  @RequirePermissions('refund.create')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRefundSchema)) body: CreateRefundInput,
    @Req() req: Request,
  ) {
    return this.refunds.create(user, body, ctxOf(req));
  }

  @Post(':id/approve')
  @RequirePermissions('refund.approve')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(approveSchema)) body: { restock: boolean },
    @Req() req: Request,
  ) {
    return this.refunds.approve(user, id, body.restock, ctxOf(req));
  }

  @Post(':id/reject')
  @RequirePermissions('refund.approve')
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.refunds.reject(user, id, ctxOf(req));
  }
}
