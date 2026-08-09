import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { nearestBranchQuerySchema, paginationSchema, uuidSchema } from '@repo/validation';
import { StorefrontService } from './storefront.service';
import { SettingsService } from '../content/settings.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const catalogueQuerySchema = paginationSchema.extend({
  branchId: uuidSchema,
  categorySlug: z.string().max(200).optional(),
  search: z.string().max(200).optional(),
  brand: z.string().max(120).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'name']).default('newest'),
});

/**
 * Public storefront endpoints. No authentication; everything is scoped by
 * the customer's chosen branch and only ACTIVE+visible products are exposed.
 */
@ApiTags('storefront')
@Controller('storefront')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 300, ttl: 60_000 } })
export class StorefrontController {
  constructor(
    private readonly storefront: StorefrontService,
    private readonly settings: SettingsService,
  ) {}

  @Get('settings')
  publicSettings() {
    return this.settings.publicSettings();
  }

  /** Public Stripe publishable key + configured flag for checkout UI. */
  @Get('payment-config')
  paymentConfig() {
    return this.settings.getPublicPaymentConfig();
  }

  @Get('branches')
  branches() {
    return this.storefront.branches();
  }

  @Get('branches/nearest')
  nearestBranch(
    @Query(new ZodValidationPipe(nearestBranchQuerySchema))
    query: z.infer<typeof nearestBranchQuerySchema>,
  ) {
    return this.storefront.nearestBranches(query.postcode);
  }

  @Get('categories')
  categories(@Query('branchId') branchId?: string) {
    const id = branchId && uuidSchema.safeParse(branchId).success ? branchId : undefined;
    return this.storefront.categories(id);
  }

  @Get('brands')
  brands(@Query('branchId') branchId?: string) {
    const id = branchId && uuidSchema.safeParse(branchId).success ? branchId : undefined;
    return this.storefront.brands(id);
  }

  @Get('products')
  products(
    @Query(new ZodValidationPipe(catalogueQuerySchema)) query: z.infer<typeof catalogueQuerySchema>,
  ) {
    return this.storefront.products(query);
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string, @Query('branchId', new ZodValidationPipe(uuidSchema)) branchId: string) {
    return this.storefront.productDetail(slug, branchId);
  }

  @Get('banners')
  banners(@Query('branchId', new ZodValidationPipe(uuidSchema)) branchId: string) {
    return this.storefront.banners(branchId);
  }

  @Get('home')
  home(@Query('branchId', new ZodValidationPipe(uuidSchema)) branchId: string) {
    return this.storefront.home(branchId);
  }
}
