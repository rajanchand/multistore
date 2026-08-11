import { Injectable } from '@nestjs/common';
import type { Prisma } from '@repo/database';
import { loadServerEnv } from '@repo/config';
import type {
  DeliveryDefaultsInput,
  SocialLinksInput,
  StoreDetailsInput,
  UpdatePluginInput,
} from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';
import {
  DEFAULT_DELIVERY,
  DEFAULT_SOCIAL_LINKS,
  DEFAULT_STORE_DETAILS,
  SETTING_KEYS,
} from './settings.defaults';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getGlobalJson<T extends Record<string, unknown>>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.setting.findFirst({ where: { key, branchId: null } });
    if (!row?.value || typeof row.value !== 'object' || Array.isArray(row.value)) {
      return { ...fallback };
    }
    return { ...fallback, ...(row.value as T) };
  }

  private async setGlobalJson(
    user: AuthenticatedUser,
    key: string,
    value: Record<string, unknown>,
    action: string,
    ctx: RequestContext,
  ) {
    const existing = await this.prisma.setting.findFirst({ where: { key, branchId: null } });
    const row = existing
      ? await this.prisma.setting.update({
          where: { id: existing.id },
          data: { value: value as Prisma.InputJsonValue },
        })
      : await this.prisma.setting.create({
          data: { key, branchId: null, value: value as Prisma.InputJsonValue },
        });
    await this.audit.log({
      actorUserId: user.id,
      action,
      resourceType: 'Setting',
      resourceId: row.id,
      newValue: { key },
      requestId: ctx.requestId,
    });
    return row.value;
  }

  getStoreDetails() {
    return this.getGlobalJson(SETTING_KEYS.store, DEFAULT_STORE_DETAILS as Record<string, unknown>) as Promise<StoreDetailsInput>;
  }

  async updateStoreDetails(user: AuthenticatedUser, input: StoreDetailsInput, ctx: RequestContext) {
    await this.setGlobalJson(user, SETTING_KEYS.store, input, 'STORE_DETAILS_UPDATED', ctx);
    return this.getStoreDetails();
  }

  getSocialLinks() {
    return this.getGlobalJson(SETTING_KEYS.social, DEFAULT_SOCIAL_LINKS as Record<string, unknown>) as Promise<SocialLinksInput>;
  }

  async updateSocialLinks(user: AuthenticatedUser, input: SocialLinksInput, ctx: RequestContext) {
    await this.setGlobalJson(user, SETTING_KEYS.social, input, 'SOCIAL_LINKS_UPDATED', ctx);
    return this.getSocialLinks();
  }

  getDeliveryDefaults() {
    return this.getGlobalJson(SETTING_KEYS.delivery, DEFAULT_DELIVERY as Record<string, unknown>) as Promise<DeliveryDefaultsInput>;
  }

  async updateDeliveryDefaults(user: AuthenticatedUser, input: DeliveryDefaultsInput, ctx: RequestContext) {
    await this.setGlobalJson(user, SETTING_KEYS.delivery, input, 'DELIVERY_DEFAULTS_UPDATED', ctx);
    return this.getDeliveryDefaults();
  }

  getPaymentIntegrationStatus() {
    const env = loadServerEnv();
    const secret = env.STRIPE_SECRET_KEY;
    const publishable = env.STRIPE_PUBLISHABLE_KEY;
    return {
      stripe: {
        configured: Boolean(secret),
        mode: secret?.startsWith('sk_live') ? 'live' : secret?.startsWith('sk_test') ? 'test' : 'unknown',
        publishableKeyConfigured: Boolean(publishable),
        publishableKeyHint: publishable ? `${publishable.slice(0, 12)}…` : null,
        webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
        envVars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
      },
      wallets: {
        applePay: {
          via: 'stripe',
          setup: [
            'Enable Apple Pay in Stripe Dashboard → Settings → Payment methods',
            'Add and verify your storefront domain for Apple Pay',
            'Use Stripe Payment Element / Payment Request Button on checkout',
          ],
          docsUrl: 'https://docs.stripe.com/apple-pay',
        },
        googlePay: {
          via: 'stripe',
          setup: [
            'Enable Google Pay in Stripe Dashboard → Settings → Payment methods',
            'Serve checkout over HTTPS with Stripe.js Payment Element',
            'Google Pay appears automatically where the customer device supports it',
          ],
          docsUrl: 'https://docs.stripe.com/google-pay',
        },
      },
      docs: {
        stripe: 'https://docs.stripe.com/payments/payment-element',
        webhooks: 'https://docs.stripe.com/webhooks',
      },
    };
  }

  /** Google Gemini status for SMS compose + catalogue image enrichment (never exposes the key). */
  getGeminiIntegrationStatus() {
    const env = loadServerEnv();
    const configured = Boolean(env.GEMINI_API_KEY?.trim());
    const smsModel = (env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash').replace(/^models\//, '');
    const imageModel = (env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image').replace(
      /^models\//,
      '',
    );
    return {
      provider: 'google-gemini',
      configured,
      smsModel,
      imageModel,
      envVars: ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_IMAGE_MODEL'],
      setup: [
        'Create an API key at https://aistudio.google.com/apikey',
        'Set GEMINI_API_KEY in the API root .env (never commit the key)',
        'Optional: GEMINI_MODEL (SMS) and GEMINI_IMAGE_MODEL (packshots)',
        'Restart the API process after changing env',
        'Generate catalogue images with: pnpm db:enrich-images',
      ],
      docsUrl: 'https://aistudio.google.com/apikey',
      message: configured
        ? 'Gemini is configured. SMS Generate with AI uses the live model; run pnpm db:enrich-images for packshots.'
        : 'Gemini is not configured. SMS falls back to templates. Add GEMINI_API_KEY to .env and restart the API.',
    };
  }

  listPlugins(includeDisabled = true, category?: string) {
    return this.prisma.plugin.findMany({
      where: {
        deletedAt: null,
        ...(includeDisabled ? {} : { isEnabled: true }),
        ...(category ? { category } : {}),
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async updatePlugin(user: AuthenticatedUser, id: string, input: UpdatePluginInput, ctx: RequestContext) {
    const existing = await this.prisma.plugin.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw Errors.notFound('Plugin');
    const plugin = await this.prisma.plugin.update({
      where: { id },
      data: {
        ...input,
        config: (input.config ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'PLUGIN_UPDATED',
      resourceType: 'Plugin',
      resourceId: id,
      newValue: { code: plugin.code, isEnabled: plugin.isEnabled },
      requestId: ctx.requestId,
    });
    return plugin;
  }

  async publicSettings() {
    const [store, social, delivery, plugins, paymentMethods] = await Promise.all([
      this.getStoreDetails(),
      this.getSocialLinks(),
      this.getDeliveryDefaults(),
      this.prisma.plugin.findMany({
        where: { deletedAt: null, isEnabled: true },
        orderBy: [{ sortOrder: 'asc' }],
        select: {
          code: true,
          name: true,
          category: true,
          provider: true,
          config: true,
        },
      }),
      this.prisma.paymentMethodConfig.findMany({
        where: { deletedAt: null, isEnabled: true },
        orderBy: [{ sortOrder: 'asc' }],
        select: { code: true, name: true, provider: true },
      }),
    ]);
    return { store, social, delivery, plugins, paymentMethods };
  }

  /**
   * Safe for the storefront: publishable key is designed to be public.
   * Never expose STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET here.
   */
  getPublicPaymentConfig() {
    const env = loadServerEnv();
    const publishableKey = env.STRIPE_PUBLISHABLE_KEY?.trim() || null;
    const secretConfigured = Boolean(env.STRIPE_SECRET_KEY?.trim());
    return {
      provider: 'stripe' as const,
      configured: secretConfigured && Boolean(publishableKey),
      publishableKey,
      message: secretConfigured && publishableKey
        ? null
        : 'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY (test keys) in the API .env, and restart the API. For webhooks locally run: stripe listen --forward-to localhost:4000/api/v1/payments/webhooks/stripe',
    };
  }
}
