import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import {
  generateSmsSchema,
  sendSmsSchema,
  type GenerateSmsInput,
  type SendSmsInput,
} from '@repo/validation';
import { SmsService } from './sms.service';
import { SettingsService } from '../content/settings.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

function ctxOf(req: Request): RequestContext {
  return { requestId: (req as Request & { requestId?: string }).requestId, ip: req.ip };
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

@ApiTags('sms')
@Controller('sms')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequirePermissions('sms.send')
export class SmsController {
  constructor(
    private readonly sms: SmsService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>,
  ) {
    return this.sms.list(user, query.page, query.pageSize);
  }

  @Get('gemini-status')
  geminiStatus() {
    return this.settings.getGeminiIntegrationStatus();
  }

  @Post('generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(generateSmsSchema)) body: GenerateSmsInput,
  ) {
    return this.sms.generate(user, body);
  }

  @Post('send')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(sendSmsSchema)) body: SendSmsInput,
    @Req() req: Request,
  ) {
    return this.sms.send(user, body, ctxOf(req));
  }
}
