import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { bulkOperationSchema, paginationSchema, type BulkOperationInput } from '@repo/validation';
import { BulkOperationsService } from './bulk-operations.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';
import type { z } from 'zod';

function ctxOf(req: Request): RequestContext {
  return { requestId: (req as Request & { requestId?: string }).requestId, ip: req.ip };
}

@ApiTags('bulk-operations')
@Controller('bulk-operations')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequirePermissions('product.bulk_manage')
export class BulkOperationsController {
  constructor(private readonly bulk: BulkOperationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paginationSchema)) query: z.infer<typeof paginationSchema>,
  ) {
    return this.bulk.list(user, query.page, query.pageSize);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bulk.get(user, id);
  }

  @Post('preview')
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(bulkOperationSchema)) body: BulkOperationInput,
  ) {
    return this.bulk.preview(user, body);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(bulkOperationSchema)) body: BulkOperationInput,
    @Req() req: Request,
  ) {
    return this.bulk.enqueue(user, body, ctxOf(req));
  }
}
