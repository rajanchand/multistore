import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  createFaqSchema,
  createPaymentMethodSchema,
  deliveryDefaultsSchema,
  socialLinksSchema,
  storeDetailsSchema,
  updateFaqSchema,
  updatePaymentMethodSchema,
  updatePluginSchema,
  upsertAboutSchema,
  type CreateFaqInput,
  type CreatePaymentMethodInput,
  type DeliveryDefaultsInput,
  type SocialLinksInput,
  type StoreDetailsInput,
  type UpdateFaqInput,
  type UpdatePaymentMethodInput,
  type UpdatePluginInput,
  type UpsertAboutInput,
} from '@repo/validation';
import { ContentService } from './content.service';
import { SettingsService } from './settings.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

function ctxOf(req: Request): RequestContext {
  return { requestId: (req as Request & { requestId?: string }).requestId, ip: req.ip };
}

@ApiTags('content')
@Controller()
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequirePermissions('settings.manage')
export class ContentController {
  constructor(
    private readonly content: ContentService,
    private readonly settings: SettingsService,
  ) {}

  @Get('faqs')
  listFaqs(@Query('includeUnpublished') includeUnpublished?: string) {
    return this.content.listFaqs(includeUnpublished === 'true');
  }

  @Post('faqs')
  createFaq(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createFaqSchema)) body: CreateFaqInput,
    @Req() req: Request,
  ) {
    return this.content.createFaq(user, body, ctxOf(req));
  }

  @Patch('faqs/:id')
  updateFaq(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateFaqSchema)) body: UpdateFaqInput,
    @Req() req: Request,
  ) {
    return this.content.updateFaq(user, id, body, ctxOf(req));
  }

  @Post('faqs/:id/archive')
  archiveFaq(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.content.archiveFaq(user, id, ctxOf(req));
  }

  @Get('about')
  listAbout() {
    return this.content.listAbout();
  }

  @Post('about')
  upsertAbout(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(upsertAboutSchema)) body: UpsertAboutInput,
    @Req() req: Request,
  ) {
    return this.content.upsertAbout(user, body, ctxOf(req));
  }

  @Get('payment-methods')
  listPaymentMethods(@Query('includeDisabled') includeDisabled?: string) {
    return this.content.listPaymentMethods(includeDisabled !== 'false');
  }

  @Post('payment-methods')
  createPaymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPaymentMethodSchema)) body: CreatePaymentMethodInput,
    @Req() req: Request,
  ) {
    return this.content.createPaymentMethod(user, body, ctxOf(req));
  }

  @Patch('payment-methods/:id')
  updatePaymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePaymentMethodSchema)) body: UpdatePaymentMethodInput,
    @Req() req: Request,
  ) {
    return this.content.updatePaymentMethod(user, id, body, ctxOf(req));
  }

  @Post('payment-methods/:id/archive')
  archivePaymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.content.archivePaymentMethod(user, id, ctxOf(req));
  }

  @Get('settings/store')
  getStoreDetails() {
    return this.settings.getStoreDetails();
  }

  @Put('settings/store')
  updateStoreDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(storeDetailsSchema)) body: StoreDetailsInput,
    @Req() req: Request,
  ) {
    return this.settings.updateStoreDetails(user, body, ctxOf(req));
  }

  @Get('settings/social')
  getSocialLinks() {
    return this.settings.getSocialLinks();
  }

  @Put('settings/social')
  updateSocialLinks(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(socialLinksSchema)) body: SocialLinksInput,
    @Req() req: Request,
  ) {
    return this.settings.updateSocialLinks(user, body, ctxOf(req));
  }

  @Get('settings/delivery')
  getDeliveryDefaults() {
    return this.settings.getDeliveryDefaults();
  }

  @Put('settings/delivery')
  updateDeliveryDefaults(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(deliveryDefaultsSchema)) body: DeliveryDefaultsInput,
    @Req() req: Request,
  ) {
    return this.settings.updateDeliveryDefaults(user, body, ctxOf(req));
  }

  @Get('settings/payments/integration')
  paymentIntegrationStatus() {
    return this.settings.getPaymentIntegrationStatus();
  }

  @Get('settings/gemini/integration')
  geminiIntegrationStatus() {
    return this.settings.getGeminiIntegrationStatus();
  }

  @Get('plugins')
  listPlugins(
    @Query('includeDisabled') includeDisabled?: string,
    @Query('category') category?: string,
  ) {
    return this.settings.listPlugins(
      includeDisabled !== 'false',
      category?.trim() || undefined,
    );
  }

  @Patch('plugins/:id')
  updatePlugin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePluginSchema)) body: UpdatePluginInput,
    @Req() req: Request,
  ) {
    return this.settings.updatePlugin(user, id, body, ctxOf(req));
  }
}
