import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  createBannerSchema,
  updateBannerSchema,
  type CreateBannerInput,
  type UpdateBannerInput,
} from '@repo/validation';
import { BannersService } from './banners.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

function ctxOf(req: Request): RequestContext {
  return { requestId: (req as Request & { requestId?: string }).requestId, ip: req.ip };
}

@ApiTags('banners')
@Controller('banners')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequirePermissions('banner.manage')
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.banners.list(user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBannerSchema)) body: CreateBannerInput,
    @Req() req: Request,
  ) {
    return this.banners.create(user, body, ctxOf(req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateBannerSchema)) body: UpdateBannerInput,
    @Req() req: Request,
  ) {
    return this.banners.update(user, id, body, ctxOf(req));
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.banners.archive(user, id, ctxOf(req));
  }
}
