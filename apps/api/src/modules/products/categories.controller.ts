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
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
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

@ApiTags('categories')
@Controller('categories')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @RequirePermissions('category.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query('includeHidden') includeHidden?: string) {
    return this.catalogue.listCategories(user, includeHidden !== 'false');
  }

  @Get(':id')
  @RequirePermissions('category.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogue.getCategory(user, id);
  }

  @Post()
  @RequirePermissions('category.manage')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput,
    @Req() req: Request,
  ) {
    return this.catalogue.createCategory(user, body, ctxOf(req));
  }

  @Patch(':id')
  @RequirePermissions('category.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
    @Req() req: Request,
  ) {
    return this.catalogue.updateCategory(user, id, body, ctxOf(req));
  }

  @Post(':id/hide')
  @RequirePermissions('category.manage')
  hide(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.catalogue.setCategoryVisibility(user, id, false, ctxOf(req));
  }

  @Post(':id/show')
  @RequirePermissions('category.manage')
  show(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.catalogue.setCategoryVisibility(user, id, true, ctxOf(req));
  }

  @Post(':id/archive')
  @RequirePermissions('category.manage')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.catalogue.archiveCategory(user, id, ctxOf(req));
  }
}
