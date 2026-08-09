import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  createBranchSchema,
  updateBranchSchema,
  type CreateBranchInput,
  type UpdateBranchInput,
} from '@repo/validation';
import { BranchesService } from './branches.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

function ctxOf(req: Request): RequestContext {
  return {
    requestId: (req as Request & { requestId?: string }).requestId,
    ip: req.ip,
    userAgent: req.header('user-agent'),
  };
}

@ApiTags('branches')
@Controller('branches')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @RequirePermissions('branch.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query('includeInactive') includeInactive?: string) {
    return this.branches.list(user, includeInactive === 'true');
  }

  @Get(':id')
  @RequirePermissions('branch.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.branches.getById(user, id);
  }

  @Post()
  @RequirePermissions('branch.create')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBranchSchema)) body: CreateBranchInput,
    @Req() req: Request,
  ) {
    return this.branches.create(user, body, ctxOf(req));
  }

  @Patch(':id')
  @RequirePermissions('branch.update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) body: UpdateBranchInput,
    @Req() req: Request,
  ) {
    return this.branches.update(user, id, body, ctxOf(req));
  }

  @Post(':id/disable')
  @RequirePermissions('branch.update')
  disable(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.branches.setActive(user, id, false, ctxOf(req));
  }

  @Post(':id/enable')
  @RequirePermissions('branch.update')
  enable(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.branches.setActive(user, id, true, ctxOf(req));
  }

  @Post(':id/archive')
  @RequirePermissions('branch.archive')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.branches.archive(user, id, ctxOf(req));
  }
}
