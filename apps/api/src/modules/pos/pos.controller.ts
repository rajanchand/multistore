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
import {
  posLookupQuerySchema,
  posSaleSchema,
  posTerminalActionSchema,
  type PosLookupQuery,
  type PosSaleInput,
  type PosTerminalActionInput,
} from '@repo/validation';
import { PosService } from './pos.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

function ctxOf(req: Request): RequestContext {
  return { requestId: (req as Request & { requestId?: string }).requestId, ip: req.ip };
}

@ApiTags('pos')
@Controller('pos')
@UseGuards(AdminAuthGuard, PermissionsGuard, ThrottlerGuard)
export class PosController {
  constructor(private readonly pos: PosService) {}

  @Get('lookup')
  @RequirePermissions('pos.use')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  lookup(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(posLookupQuerySchema)) query: PosLookupQuery,
  ) {
    return this.pos.lookup(user, query);
  }

  @Post('sales')
  @HttpCode(201)
  @RequirePermissions('pos.use')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  createSale(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(posSaleSchema)) body: PosSaleInput,
    @Req() req: Request,
  ) {
    return this.pos.createSale(user, body, ctxOf(req));
  }

  @Get('terminal/:sessionId')
  @RequirePermissions('pos.use')
  getTerminal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.pos.getTerminalSession(user, sessionId);
  }

  @Post('terminal/:sessionId/approve')
  @HttpCode(200)
  @RequirePermissions('pos.use')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body(new ZodValidationPipe(posTerminalActionSchema)) body: PosTerminalActionInput,
    @Req() req: Request,
  ) {
    return this.pos.approveTerminal(user, sessionId, body, ctxOf(req));
  }

  @Post('terminal/:sessionId/decline')
  @HttpCode(200)
  @RequirePermissions('pos.use')
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body(new ZodValidationPipe(posTerminalActionSchema)) body: PosTerminalActionInput,
    @Req() req: Request,
  ) {
    return this.pos.declineTerminal(user, sessionId, body, ctxOf(req));
  }

  @Post('terminal/:sessionId/cancel')
  @HttpCode(200)
  @RequirePermissions('pos.use')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: Request,
  ) {
    return this.pos.cancelTerminal(user, sessionId, ctxOf(req));
  }
}
