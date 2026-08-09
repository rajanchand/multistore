import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  createBrandSchema,
  updateBrandSchema,
  type CreateBrandInput,
  type UpdateBrandInput,
} from '@repo/validation';
import { CatalogueService } from './catalogue.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

function ctxOf(req: Request): RequestContext {
  return { requestId: (req as Request & { requestId?: string }).requestId, ip: req.ip };
}

@ApiTags('brands')
@Controller('brands')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class BrandsController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @RequirePermissions('brand.read')
  list(@Query('includeHidden') includeHidden?: string) {
    return this.catalogue.listBrands(includeHidden !== 'false');
  }

  @Get(':id')
  @RequirePermissions('brand.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogue.getBrand(id);
  }

  @Post()
  @RequirePermissions('brand.manage')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBrandSchema)) body: CreateBrandInput,
    @Req() req: Request,
  ) {
    return this.catalogue.createBrand(user, body, ctxOf(req));
  }

  @Patch(':id')
  @RequirePermissions('brand.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateBrandSchema)) body: UpdateBrandInput,
    @Req() req: Request,
  ) {
    return this.catalogue.updateBrand(user, id, body, ctxOf(req));
  }

  @Post(':id/hide')
  @RequirePermissions('brand.manage')
  hide(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.catalogue.setBrandVisibility(user, id, false, ctxOf(req));
  }

  @Post(':id/show')
  @RequirePermissions('brand.manage')
  show(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.catalogue.setBrandVisibility(user, id, true, ctxOf(req));
  }

  @Post(':id/archive')
  @RequirePermissions('brand.manage')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.catalogue.archiveBrand(user, id, ctxOf(req));
  }
}
