import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import {
  emailSchema,
  orderStatusUpdateSchema,
  paginationSchema,
  uuidSchema,
  type OrderStatusUpdateInput,
} from '@repo/validation';
import { OrdersService } from './orders.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CustomerAuthGuard } from '../../common/guards/customer-auth.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentCustomer, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedCustomer, AuthenticatedUser, RequestContext } from '../../common/auth-context';

const orderListQuerySchema = paginationSchema.extend({
  branchId: uuidSchema.optional(),
  status: z
    .enum([
      'PENDING',
      'PAYMENT_PENDING',
      'PAID',
      'CONFIRMED',
      'PREPARING',
      'READY_FOR_COLLECTION',
      'DISPATCHED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'RETURN_REQUESTED',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
      'RETURNED',
    ])
    .optional(),
  source: z.enum(['ONLINE', 'POS', 'CASH']).optional(),
  search: z.string().max(200).optional(),
  customerId: uuidSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const trackOrderSchema = z.object({
  orderNumber: z.string().trim().regex(/^ORD-\d{6,}$/),
  email: emailSchema,
});

const returnRequestSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
  items: z
    .array(z.object({ orderItemId: uuidSchema, quantity: z.number().int().min(1) }))
    .optional(),
});

function ctxOf(req: Request): RequestContext {
  return { requestId: (req as Request & { requestId?: string }).requestId, ip: req.ip };
}

@ApiTags('orders')
@Controller('orders')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermissions('order.read')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(orderListQuerySchema)) query: z.infer<typeof orderListQuerySchema>,
  ) {
    return this.orders.list(user, query);
  }

  @Get(':id')
  @RequirePermissions('order.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getById(user, id);
  }

  @Post(':id/status')
  @RequirePermissions('order.update')
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(orderStatusUpdateSchema)) body: OrderStatusUpdateInput,
    @Req() req: Request,
  ) {
    return this.orders.transition(user, id, body.status, body.notes, ctxOf(req));
  }
}

@ApiTags('my-orders')
@Controller('my/orders')
@UseGuards(CustomerAuthGuard)
export class MyOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Query(new ZodValidationPipe(paginationSchema)) query: z.infer<typeof paginationSchema>,
  ) {
    return this.orders.listForCustomer(customer.id, query.page, query.pageSize);
  }

  @Get(':id')
  get(@CurrentCustomer() customer: AuthenticatedCustomer, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getForCustomer(customer.id, id);
  }

  @Post(':id/return')
  requestReturn(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(returnRequestSchema)) body: z.infer<typeof returnRequestSchema>,
  ) {
    return this.orders.requestReturn(customer.id, id, body.reason, body.items);
  }
}

@ApiTags('track')
@Controller('track-order')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class TrackOrderController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(200)
  track(@Body(new ZodValidationPipe(trackOrderSchema)) body: z.infer<typeof trackOrderSchema>) {
    return this.orders.track(body.orderNumber, body.email);
  }
}
