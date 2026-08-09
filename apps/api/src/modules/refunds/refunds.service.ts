import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { CreateRefundInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/payment-provider.interface';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

/**
 * Refund workflow: refund.create raises a PENDING request; refund.approve
 * executes it at the provider. Double-refund protection:
 *  - deterministic idempotencyKey unique constraint (same request → same refund),
 *  - total refunded (succeeded + in-flight) can never exceed the captured amount,
 *  - provider call carries the same idempotency key.
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger('Refunds');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly notifications: NotificationsService,
    private readonly branchAccess: BranchAccessService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async create(user: AuthenticatedUser, input: CreateRefundInput, ctx: RequestContext) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        payments: { where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] } } },
        items: true,
      },
    });
    if (!order) throw Errors.notFound('Order');
    this.branchAccess.assertCanAccess(user, order.branchId);

    const payment = order.payments[0];
    if (!payment) {
      throw Errors.conflict('NO_CAPTURED_PAYMENT', 'This order has no successful payment to refund.');
    }

    // Amount: explicit, or derived from items, or full remaining amount.
    let amount = input.amount;
    if (amount == null && input.items && input.items.length > 0) {
      amount = 0;
      for (const item of input.items) {
        const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
        if (!orderItem) throw Errors.notFound('Order item');
        const refundableQty = orderItem.quantity - orderItem.refundedQuantity;
        if (item.quantity > refundableQty) {
          throw Errors.conflict('OVER_REFUND_QUANTITY', `Only ${refundableQty} unit(s) of ${orderItem.productName} can still be refunded.`);
        }
        amount += orderItem.unitPrice * item.quantity;
      }
    }
    if (amount == null) {
      const refundedSoFar = await this.refundedOrInFlight(payment.id);
      amount = payment.amount - refundedSoFar;
    }
    if (amount <= 0) throw Errors.badRequest('INVALID_AMOUNT', 'Refund amount must be positive.');

    const refundedSoFar = await this.refundedOrInFlight(payment.id);
    if (refundedSoFar + amount > payment.amount) {
      throw Errors.conflict(
        'REFUND_EXCEEDS_PAYMENT',
        `Refund would exceed the captured amount (${payment.amount - refundedSoFar} remaining).`,
      );
    }

    // Deterministic idempotency key: identical repeated requests dedupe.
    const idempotencyKey = createHash('sha256')
      .update(`refund:${payment.id}:${amount}:${input.reason}:${JSON.stringify(input.items ?? [])}`)
      .digest('hex');

    const existing = await this.prisma.refund.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const refund = await this.prisma.refund.create({
      data: {
        orderId: order.id,
        paymentId: payment.id,
        amount,
        reason: input.reason,
        idempotencyKey,
        createdById: user.id,
        status: 'PENDING',
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      branchId: order.branchId,
      action: 'REFUND_CREATED',
      resourceType: 'Refund',
      resourceId: refund.id,
      newValue: { amount, reason: input.reason, orderNumber: order.orderNumber },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return refund;
  }

  /** Approve and execute a pending refund at the provider. Requires refund.approve. */
  async approve(user: AuthenticatedUser, refundId: string, restock: boolean, ctx: RequestContext) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { order: { include: { items: true } }, payment: true },
    });
    if (!refund) throw Errors.notFound('Refund');
    this.branchAccess.assertCanAccess(user, refund.order.branchId);
    if (refund.status !== 'PENDING') {
      throw Errors.conflict('REFUND_NOT_PENDING', `Refund is already ${refund.status}.`);
    }
    // Self-approval requires being a different user than the requester when possible.
    if (refund.createdById === user.id && !user.isGlobal) {
      throw Errors.forbidden('Refunds must be approved by a different user.');
    }

    // Claim the refund row first (concurrency-safe): only one approver wins.
    const claimed = await this.prisma.refund.updateMany({
      where: { id: refundId, status: 'PENDING' },
      data: { status: 'PROCESSING', approvedById: user.id },
    });
    if (claimed.count === 0) {
      throw Errors.conflict('REFUND_NOT_PENDING', 'Refund was already processed.');
    }

    try {
      const result = await this.provider.refundPayment({
        providerPaymentId: refund.payment.providerPaymentId,
        amount: refund.amount,
        reason: refund.reason,
        idempotencyKey: refund.idempotencyKey,
      });

      const finalStatus = result.status === 'FAILED' ? 'FAILED' : 'SUCCEEDED';
      await this.prisma.$transaction(async (tx) => {
        await tx.refund.update({
          where: { id: refundId },
          data: { status: finalStatus, providerRefundId: result.providerRefundId },
        });
        if (finalStatus === 'SUCCEEDED') {
          const succeeded = await tx.refund.aggregate({
            where: { paymentId: refund.paymentId, status: 'SUCCEEDED' },
            _sum: { amount: true },
          });
          const totalRefunded = succeeded._sum.amount ?? 0;
          const fullyRefunded = totalRefunded >= refund.payment.amount;
          await tx.payment.update({
            where: { id: refund.paymentId },
            data: {
              amountRefunded: totalRefunded,
              status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            },
          });
          await tx.order.update({
            where: { id: refund.orderId },
            data: { status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: refund.orderId,
              from: refund.order.status,
              to: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
              actorUserId: user.id,
              notes: `Refund ${refund.amount} (${refund.reason})`,
            },
          });
        }
      });

      // Restock is a deliberate, separate business decision — never automatic.
      if (restock && finalStatus === 'SUCCEEDED') {
        for (const item of refund.order.items) {
          await this.inventory.restock(user, {
            branchId: refund.order.branchId,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            reference: `refund:${refund.id}`,
          });
        }
      }

      await this.audit.log({
        actorUserId: user.id,
        branchId: refund.order.branchId,
        action: 'REFUND_APPROVED',
        resourceType: 'Refund',
        resourceId: refundId,
        newValue: { amount: refund.amount, status: finalStatus, restock },
        requestId: ctx.requestId,
        ipAddress: ctx.ip,
      });
      if (finalStatus === 'SUCCEEDED') {
        await this.notifications.queueOrderEvent('refund.completed', refund.orderId);
      }
      return this.prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
    } catch (error) {
      // Provider failure: return the refund to PENDING for retry.
      await this.prisma.refund.update({
        where: { id: refundId },
        data: { status: 'PENDING', approvedById: null },
      });
      this.logger.error(`Refund ${refundId} provider call failed: ${String(error)}`);
      throw error;
    }
  }

  async reject(user: AuthenticatedUser, refundId: string, ctx: RequestContext) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { order: { select: { branchId: true } } },
    });
    if (!refund) throw Errors.notFound('Refund');
    this.branchAccess.assertCanAccess(user, refund.order.branchId);
    if (refund.status !== 'PENDING') {
      throw Errors.conflict('REFUND_NOT_PENDING', `Refund is already ${refund.status}.`);
    }
    const updated = await this.prisma.refund.update({
      where: { id: refundId },
      data: { status: 'REJECTED', approvedById: user.id },
    });
    await this.audit.log({
      actorUserId: user.id,
      branchId: refund.order.branchId,
      action: 'REFUND_REJECTED',
      resourceType: 'Refund',
      resourceId: refundId,
      requestId: ctx.requestId,
    });
    return updated;
  }

  async list(user: AuthenticatedUser, params: { page: number; pageSize: number; status?: string }) {
    const where = {
      ...(params.status ? { status: params.status as never } : {}),
      order: user.isGlobal ? {} : { branchId: { in: [...user.branchIds] } },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              branch: { select: { id: true, name: true, code: true } },
              customer: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.refund.count({ where }),
    ]);
    return { items, total, page: params.page, pageSize: params.pageSize, totalPages: Math.ceil(total / params.pageSize) };
  }

  /** Total refunded plus refunds still in flight (PENDING/APPROVED/PROCESSING). */
  private async refundedOrInFlight(paymentId: string): Promise<number> {
    const agg = await this.prisma.refund.aggregate({
      where: { paymentId, status: { in: ['PENDING', 'APPROVED', 'PROCESSING', 'SUCCEEDED'] } },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }
}
