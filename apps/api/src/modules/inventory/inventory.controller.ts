import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import {
  adjustInventorySchema,
  createTransferSchema,
  paginationSchema,
  setLowStockThresholdSchema,
  transferTransitionSchema,
  uuidSchema,
  type AdjustInventoryInput,
  type CreateTransferInput,
  type SetLowStockThresholdInput,
  type TransferTransitionInput,
} from '@repo/validation';
import { InventoryService } from './inventory.service';
import { TransfersService } from './transfers.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

const inventoryQuerySchema = paginationSchema.extend({
  branchId: uuidSchema.optional(),
  search: z.string().max(200).optional(),
  lowStockOnly: z.coerce.boolean().default(false),
});

const movementsQuerySchema = paginationSchema.extend({
  branchId: uuidSchema.optional(),
  variantId: uuidSchema.optional(),
});

const transfersQuerySchema = paginationSchema.extend({
  status: z
    .enum(['REQUESTED', 'APPROVED', 'PREPARING', 'IN_TRANSIT', 'RECEIVED', 'REJECTED', 'CANCELLED'])
    .optional(),
});

function ctxOf(req: Request): RequestContext {
  return {
    requestId: (req as Request & { requestId?: string }).requestId,
    ip: req.ip,
    userAgent: req.header('user-agent'),
  };
}

@ApiTags('inventory')
@Controller('inventory')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly transfers: TransfersService,
  ) {}

  @Get()
  @RequirePermissions('inventory.read')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(inventoryQuerySchema)) query: z.infer<typeof inventoryQuerySchema>,
  ) {
    return this.inventory.list(user, query);
  }

  @Get('movements')
  @RequirePermissions('inventory.read')
  movements(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(movementsQuerySchema)) query: z.infer<typeof movementsQuerySchema>,
  ) {
    return this.inventory.movements(user, query);
  }

  @Post('adjust')
  @RequirePermissions('inventory.adjust')
  adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(adjustInventorySchema)) body: AdjustInventoryInput,
    @Req() req: Request,
  ) {
    return this.inventory.adjust(user, body, ctxOf(req));
  }

  @Post('low-stock-threshold')
  @RequirePermissions('inventory.adjust')
  setThreshold(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(setLowStockThresholdSchema)) body: SetLowStockThresholdInput,
  ) {
    return this.inventory.setLowStockThreshold(user, {
      branchId: body.branchId,
      productId: body.productId,
      variantId: body.variantId ?? null,
      lowStockThreshold: body.lowStockThreshold,
    });
  }

  // --- Transfers ---

  @Get('transfers')
  @RequirePermissions('inventory.transfer')
  listTransfers(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(transfersQuerySchema)) query: z.infer<typeof transfersQuerySchema>,
  ) {
    return this.transfers.list(user, query);
  }

  @Post('transfers')
  @RequirePermissions('inventory.transfer')
  createTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTransferSchema)) body: CreateTransferInput,
    @Req() req: Request,
  ) {
    return this.transfers.create(user, body, ctxOf(req));
  }

  @Post('transfers/:id/transition')
  @RequirePermissions('inventory.transfer')
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(transferTransitionSchema)) body: TransferTransitionInput,
    @Req() req: Request,
  ) {
    return this.transfers.transition(user, id, body.status, body.notes, ctxOf(req));
  }
}
