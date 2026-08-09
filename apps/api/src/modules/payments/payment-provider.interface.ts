/**
 * Payment provider abstraction. Order logic depends only on this interface,
 * so adding PayPal/eSewa/Khalti/Fonepay later means implementing one class.
 */

export type ProviderPaymentStatus =
  | 'PENDING'
  | 'REQUIRES_ACTION'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export interface CreatePaymentParams {
  /** Minor units. */
  amount: number;
  currency: string;
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  /** Provider-level idempotency key (safe retries). */
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  providerPaymentId: string;
  /** Client-side secret for confirming the payment (e.g. Stripe client_secret). */
  clientSecret: string | null;
  status: ProviderPaymentStatus;
}

export interface ProviderPaymentState {
  providerPaymentId: string;
  status: ProviderPaymentStatus;
  /** Minor units actually captured. */
  amountReceived: number;
  paymentMethodSummary?: Record<string, unknown>;
  failureReason?: string;
}

export interface RefundParams {
  providerPaymentId: string;
  /** Minor units; omit for full refund. */
  amount?: number;
  reason?: string;
  idempotencyKey: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

export interface ProviderWebhookEvent {
  /** Provider-unique event ID — the idempotency anchor. */
  providerEventId: string;
  type: string;
  providerPaymentId: string | null;
  payload: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  confirmPayment(providerPaymentId: string): Promise<ProviderPaymentState>;
  getPayment(providerPaymentId: string): Promise<ProviderPaymentState>;
  refundPayment(params: RefundParams): Promise<RefundResult>;
  /** Verify webhook authenticity; throws on invalid signature. */
  verifyWebhook(rawBody: Buffer, signature: string): ProviderWebhookEvent;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
