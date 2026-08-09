import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import {
  createProductSchema,
  paginationSchema,
  updateProductSchema,
  upsertBranchProductSchema,
  uuidSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type UpsertBranchProductInput,
} from '@repo/validation';
import { ProductsService } from './products.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

const productListQuerySchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  categoryId: uuidSchema.optional(),
  branchId: uuidSchema.optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
});

function ctxOf(req: Request): RequestContext {
  return {
    requestId: (req as Request & { requestId?: string }).requestId,
    ip: req.ip,
    userAgent: req.header('user-agent'),
  };
}

@ApiTags('products')
@Controller('products')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions('product.read')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(productListQuerySchema)) query: z.infer<typeof productListQuerySchema>,
  ) {
    return this.products.list(user, query);
  }

  @Get(':id')
  @RequirePermissions('product.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.products.getById(user, id);
  }

  @Get(':id/branch-matrix')
  @RequirePermissions('product.read')
  branchMatrix(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.products.branchMatrix(user, id);
  }

  @Post()
  @RequirePermissions('product.create')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput,
    @Req() req: Request,
  ) {
    return this.products.create(user, body, ctxOf(req));
  }

  @Patch(':id')
  @RequirePermissions('product.update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductInput,
    @Req() req: Request,
  ) {
    return this.products.update(user, id, body, ctxOf(req));
  }

  @Post(':id/publish')
  @RequirePermissions('product.publish')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.products.setStatus(user, id, 'ACTIVE', ctxOf(req));
  }

  @Post(':id/hide')
  @RequirePermissions('product.publish')
  hide(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.products.setStatus(user, id, 'DRAFT', ctxOf(req));
  }

  @Post(':id/archive')
  @RequirePermissions('product.archive')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.products.setStatus(user, id, 'ARCHIVED', ctxOf(req));
  }

  /** Upsert a branch's commercial configuration (price/visibility) for a variant. */
  @Put('branch-config')
  @RequirePermissions('product.update')
  upsertBranchConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(upsertBranchProductSchema)) body: UpsertBranchProductInput,
    @Req() req: Request,
  ) {
    return this.products.upsertBranchProduct(user, body, ctxOf(req));
  }
}
