import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type ProviderWebhookEvent,
} from './payment-provider.interface';

/**
 * Payment lifecycle. Orders are only marked PAID from server-side verified
 * provider state (webhooks or direct API confirmation) — never from the client.
 *
 * Idempotency: every webhook event is recorded in PaymentEvent with a unique
 * (provider, providerEventId). A replayed event hits the unique constraint and
 * is skipped, so processing five identical events has the effect of one.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    const event = this.provider.verifyWebhook(rawBody, signature);

    // Idempotency gate: first writer wins, replays are no-ops.
    try {
      await this.prisma.paymentEvent.create({
        data: {
          provider: this.provider.name,
          providerEventId: event.providerEventId,
          type: event.type,
          payload: event.payload as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        this.logger.log(`Duplicate webhook event ${event.providerEventId} ignored`);
        return { received: true };
      }
      throw err;
    }

    await this.processEvent(event);
    return { received: true };
  }

  private async processEvent(event: ProviderWebhookEvent): Promise<void> {
    if (!event.providerPaymentId) return;

    const payment = await this.prisma.payment.findUnique({
      where: { providerPaymentId: event.providerPaymentId },
      include: { order: { include: { items: true } } },
    });
    if (!payment) {
      this.logger.warn(`Webhook for unknown payment ${event.providerPaymentId}`);
      return;
    }

    // Link the event to the payment for traceability.
    await this.prisma.paymentEvent.updateMany({
      where: { provider: this.provider.name, providerEventId: event.providerEventId },
      data: { paymentId: payment.id },
    });

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.markSucceeded(payment.id);
        break;
      case 'payment_intent.payment_failed':
        await this.markFailed(payment.id, 'Payment failed at provider.');
        break;
      case 'payment_intent.canceled':
        await this.markFailed(payment.id, 'Payment cancelled.');
        break;
      case 'charge.refunded':
        await this.syncRefundState(payment.id);
        break;
      default:
        this.logger.log(`Unhandled webhook type ${event.type}`);
    }
  }

  /**
   * Transition payment → SUCCEEDED and order → PAID, committing stock
   * reservations. Guarded by a status check inside the transaction so
   * concurrent/duplicate deliveries can't double-commit stock.
   */
  async markSucceeded(paymentId: string): Promise<void> {
    // Confirm authoritative state with the provider — never trust the payload alone.
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: { include: { items: true } } },
    });
    const providerState = await this.provider.getPayment(payment.providerPaymentId);
    if (providerState.status !== 'SUCCEEDED') {
      this.logger.warn(
        `Provider state for ${payment.providerPaymentId} is ${providerState.status}, not marking paid`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (fresh.status === 'SUCCEEDED') return; // Already processed.

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCEEDED',
          paymentMethodSummary: (providerState.paymentMethodSummary ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        include: { items: true },
      });
      if (order.status === 'PENDING' || order.status === 'PAYMENT_PENDING') {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'PAID', paidAt: new Date() },
        });
        await tx.orderStatusHistory.create({
          data: { orderId: order.id, from: order.status, to: 'PAID', isSystem: true },
        });

        // Reserved stock becomes sold.
        for (const item of order.items) {
          await this.inventory.commitSaleWithinTx(tx, {
            branchId: order.branchId,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            reference: order.orderNumber,
          });
        }
        await tx.stockReservation.updateMany({
          where: { orderId: order.id, status: 'ACTIVE' },
          data: { status: 'COMMITTED' },
        });

        // Coupon redemption counts only on successful payment.
        if (order.couponCode) {
          const coupon = await tx.coupon.findUnique({ where: { code: order.couponCode } });
          if (coupon) {
            await tx.coupon.update({
              where: { id: coupon.id },
              data: { redemptionCount: { increment: 1 } },
            });
            await tx.couponRedemption.create({
              data: { couponId: coupon.id, customerId: order.customerId, orderId: order.id },
            });
          }
        }
      }
    });

    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    await this.audit.log({
      action: 'PAYMENT_SUCCEEDED',
      resourceType: 'Payment',
      resourceId: paymentId,
      branchId: order.branchId,
      metadata: { orderNumber: order.orderNumber, amount: payment.amount },
    });
    await this.notifications.queueOrderEvent('payment.succeeded', order.id);
  }

  /** Payment failed/cancelled: release reservations, move order back or cancel. */
  async markFailed(paymentId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.status === 'FAILED' || payment.status === 'CANCELLED' || payment.status === 'SUCCEEDED') {
        return;
      }
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'FAILED', failureReason: reason },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        include: { items: true },
      });
      if (order.status === 'PENDING' || order.status === 'PAYMENT_PENDING') {
        for (const item of order.items) {
          await this.inventory.releaseWithinTx(tx, {
            branchId: order.branchId,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            reference: order.orderNumber,
          });
        }
        await tx.stockReservation.updateMany({
          where: { orderId: order.id, status: 'ACTIVE' },
          data: { status: 'RELEASED' },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            from: order.status,
            to: 'CANCELLED',
            isSystem: true,
            notes: reason,
          },
        });
      }
    });
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await this.notifications.queueOrderEvent('payment.failed', payment.orderId);
  }

  /** Reconcile refund state after charge.refunded webhook. */
  private async syncRefundState(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const state = await this.provider.getPayment(payment.providerPaymentId);
    // amountReceived stays the captured amount; refund records track amounts.
    const refunds = await this.prisma.refund.aggregate({
      where: { paymentId, status: 'SUCCEEDED' },
      _sum: { amount: true },
    });
    const refunded = refunds._sum.amount ?? 0;
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        amountRefunded: refunded,
        status:
          refunded >= payment.amount && refunded > 0
            ? 'REFUNDED'
            : refunded > 0
              ? 'PARTIALLY_REFUNDED'
              : payment.status,
      },
    });
    void state;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}
