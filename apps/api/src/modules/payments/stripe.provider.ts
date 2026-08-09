import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { loadServerEnv } from '@repo/config';
import { Errors } from '../../common/errors';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
  ProviderPaymentState,
  ProviderPaymentStatus,
  ProviderWebhookEvent,
  RefundParams,
  RefundResult,
} from './payment-provider.interface';

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger('Stripe');
  private stripe: Stripe | null = null;

  private client(): Stripe {
    if (this.stripe) return this.stripe;
    const env = loadServerEnv();
    if (!env.STRIPE_SECRET_KEY) {
      throw Errors.conflict(
        'PAYMENT_PROVIDER_NOT_CONFIGURED',
        'Stripe is not configured. Set STRIPE_SECRET_KEY (test keys in development).',
      );
    }
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
    return this.stripe;
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const intent = await this.client().paymentIntents.create(
      {
        amount: params.amount,
        currency: params.currency.toLowerCase(),
        receipt_email: params.customerEmail,
        // Enables cards plus Apple Pay / Google Pay where configured in Stripe.
        automatic_payment_methods: { enabled: true },
        metadata: {
          orderId: params.orderId,
          orderNumber: params.orderNumber,
          ...params.metadata,
        },
      },
      { idempotencyKey: params.idempotencyKey },
    );
    return {
      providerPaymentId: intent.id,
      clientSecret: intent.client_secret,
      status: mapStatus(intent.status),
    };
  }

  async confirmPayment(providerPaymentId: string): Promise<ProviderPaymentState> {
    return this.getPayment(providerPaymentId);
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentState> {
    const intent = await this.client().paymentIntents.retrieve(providerPaymentId, {
      expand: ['latest_charge'],
    });
    const charge = intent.latest_charge as Stripe.Charge | null;
    return {
      providerPaymentId: intent.id,
      status: mapStatus(intent.status),
      amountReceived: intent.amount_received,
      paymentMethodSummary: summariseCharge(charge),
      failureReason: charge?.failure_message ?? undefined,
    };
  }

  async refundPayment(params: RefundParams): Promise<RefundResult> {
    const refund = await this.client().refunds.create(
      {
        payment_intent: params.providerPaymentId,
        ...(params.amount != null ? { amount: params.amount } : {}),
        reason: 'requested_by_customer',
        metadata: params.reason ? { reason: params.reason.slice(0, 450) } : undefined,
      },
      { idempotencyKey: params.idempotencyKey },
    );
    return {
      providerRefundId: refund.id,
      status: refund.status === 'succeeded' ? 'SUCCEEDED' : refund.status === 'failed' ? 'FAILED' : 'PENDING',
    };
  }

  verifyWebhook(rawBody: Buffer, signature: string): ProviderWebhookEvent {
    const env = loadServerEnv();
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw Errors.conflict(
        'PAYMENT_PROVIDER_NOT_CONFIGURED',
        'Stripe webhook secret is not configured.',
      );
    }
    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${String(err)}`);
      throw Errors.badRequest('INVALID_WEBHOOK_SIGNATURE', 'Webhook signature verification failed.');
    }
    const object = event.data.object as { object?: string; id?: string; payment_intent?: string };
    const providerPaymentId =
      object.object === 'payment_intent'
        ? (object.id ?? null)
        : typeof object.payment_intent === 'string'
          ? object.payment_intent
          : null;
    return {
      providerEventId: event.id,
      type: event.type,
      providerPaymentId,
      payload: event,
    };
  }
}

function mapStatus(status: Stripe.PaymentIntent.Status): ProviderPaymentStatus {
  switch (status) {
    case 'succeeded':
      return 'SUCCEEDED';
    case 'processing':
      return 'PROCESSING';
    case 'requires_action':
    case 'requires_confirmation':
      return 'REQUIRES_ACTION';
    case 'requires_payment_method':
      return 'PENDING';
    case 'canceled':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

function summariseCharge(charge: Stripe.Charge | null): Record<string, unknown> | undefined {
  const card = charge?.payment_method_details?.card;
  if (!card) return undefined;
  // Only non-sensitive display data — never full PAN/CVV (Stripe never exposes them anyway).
  return { type: 'card', brand: card.brand, last4: card.last4, wallet: card.wallet?.type ?? null };
}
