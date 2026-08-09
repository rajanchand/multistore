import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import {
  createCouponSchema,
  createPromotionSchema,
  paginationSchema,
  type CreateCouponInput,
  type CreatePromotionInput,
} from '@repo/validation';
import { PromotionsService } from './promotions.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

const promotionQuerySchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
});

const updatePromotionStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']),
});

function ctxOf(req: Request): RequestContext {
  return { requestId: (req as Request & { requestId?: string }).requestId, ip: req.ip };
}

@ApiTags('promotions')
@Controller('promotions')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  @RequirePermissions('promotion.manage')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(promotionQuerySchema)) query: z.infer<typeof promotionQuerySchema>,
  ) {
    return this.promotions.list(user, query);
  }

  @Post()
  @RequirePermissions('promotion.manage')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPromotionSchema)) body: CreatePromotionInput,
    @Req() req: Request,
  ) {
    return this.promotions.create(user, body, ctxOf(req));
  }

  @Patch(':id/status')
  @RequirePermissions('promotion.manage')
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePromotionStatusSchema)) body: { status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' },
    @Req() req: Request,
  ) {
    return this.promotions.setStatus(user, id, body.status, ctxOf(req));
  }

  @Post('coupons')
  @RequirePermissions('promotion.manage')
  createCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCouponSchema)) body: CreateCouponInput,
    @Req() req: Request,
  ) {
    return this.promotions.createCoupon(user, body, ctxOf(req));
  }

  @Get('coupons')
  @RequirePermissions('promotion.manage')
  listCoupons(@Query(new ZodValidationPipe(paginationSchema)) query: z.infer<typeof paginationSchema>) {
    return this.promotions.listCoupons(query);
  }
}
