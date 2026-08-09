import { Inject, Injectable, Logger } from '@nestjs/common';
import { hashPassword } from '@repo/auth';
import type { Prisma } from '@repo/database';
import type {
  PosLookupQuery,
  PosSaleInput,
  PosTerminalActionInput,
} from '@repo/validation';
import type Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import { REDIS } from '../../redis/redis.module';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

const WALK_IN_EMAIL = 'walk-in@pos.local';
const TERMINAL_TTL_SEC = 15 * 60;
const TERMINAL_KEY = (id: string) => `pos:terminal:${id}`;

type TerminalStatus = 'AWAITING_CARD' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

interface TerminalSession {
  sessionId: string;
  paymentId: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  amount: number;
  currency: string;
  status: TerminalStatus;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
  paymentMethodSummary?: { type: string; brand?: string; last4?: string; channel: string };
}

interface ResolvedLine {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice: number;
  lineTotal: number;
  taxAmount: number;
}

/**
 * In-store POS till: barcode lookup, cash sales, and mock card-terminal presentment.
 * Reuses inventory reserve/commit and Order/Payment models; does not touch Stripe online checkout.
 */
@Injectable()
export class PosService {
  private readonly logger = new Logger('POS');

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly branchAccess: BranchAccessService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /**
   * Exact match: variant barcode → product barcode → variant SKU → product SKU.
   * Prices/stock are always from the staff member's selected branch.
   */
  async lookup(user: AuthenticatedUser, query: PosLookupQuery) {
    this.branchAccess.assertCanAccess(user, query.branchId);
    const code = query.code.trim();
    if (!code) throw Errors.badRequest('INVALID_CODE', 'Scan or enter a barcode / SKU.');

    const sellableProduct = {
      deletedAt: null,
      status: { not: 'ARCHIVED' as const },
    };

    const variant =
      (await this.prisma.productVariant.findFirst({
        where: { barcode: code, deletedAt: null, status: 'ACTIVE', product: sellableProduct },
        include: { product: true },
      })) ??
      (await this.prisma.productVariant.findFirst({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          product: { ...sellableProduct, barcode: code },
          isDefault: true,
        },
        include: { product: true },
      })) ??
      (await this.prisma.productVariant.findFirst({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          product: { ...sellableProduct, barcode: code },
        },
        include: { product: true },
        orderBy: { createdAt: 'asc' },
      })) ??
      (await this.prisma.productVariant.findFirst({
        where: { sku: code, deletedAt: null, status: 'ACTIVE', product: sellableProduct },
        include: { product: true },
      })) ??
      (await this.prisma.productVariant.findFirst({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          product: { ...sellableProduct, sku: code },
          isDefault: true,
        },
        include: { product: true },
      }));

    if (!variant) {
      throw Errors.notFound('Product');
    }

    const branchProduct = await this.prisma.branchProduct.findUnique({
      where: { branchId_variantId: { branchId: query.branchId, variantId: variant.id } },
    });
    if (!branchProduct || !branchProduct.isAvailable) {
      throw Errors.notFound('Product at this branch');
    }

    const inventory = await this.prisma.inventory.findUnique({
      where: { branchId_variantId: { branchId: query.branchId, variantId: variant.id } },
    });

    const unitPrice = branchProduct.salePrice ?? branchProduct.sellingPrice;
    const matchedBy =
      variant.barcode === code
        ? 'variant_barcode'
        : variant.product.barcode === code
          ? 'product_barcode'
          : variant.sku === code
            ? 'variant_sku'
            : 'product_sku';

    return {
      productId: variant.productId,
      variantId: variant.id,
      name: variant.product.name,
      variantName: variant.name,
      sku: variant.sku,
      barcode: variant.barcode ?? variant.product.barcode,
      matchedBy,
      unitPrice,
      originalUnitPrice: branchProduct.sellingPrice,
      currency: 'GBP',
      available: inventory?.available ?? 0,
      image:
        (Array.isArray(variant.product.images) && (variant.product.images as string[])[0]) || null,
    };
  }

  async createSale(user: AuthenticatedUser, input: PosSaleInput, ctx: RequestContext) {
    this.branchAccess.assertCanAccess(user, input.branchId);

    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, deletedAt: null, isActive: true },
    });
    if (!branch) throw Errors.notFound('Branch');

    const lines = await this.resolveLines(input.branchId, branch.taxRateBps, input.items);
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const taxTotal = lines.reduce((s, l) => s + l.taxAmount, 0);
    const total = subtotal;

    if (input.paymentType === 'CASH' && input.amountTendered != null && input.amountTendered < total) {
      throw Errors.badRequest('INSUFFICIENT_TENDER', 'Amount tendered is less than the total.');
    }

    const customer = await this.ensureWalkInCustomer();

    if (input.paymentType === 'CASH') {
      return this.completeCashSale({
        user,
        branch,
        customer,
        lines,
        subtotal,
        taxTotal,
        total,
        notes: input.notes,
        amountTendered: input.amountTendered,
        ctx,
      });
    }

    return this.startCardSale({
      user,
      branch,
      customer,
      lines,
      subtotal,
      taxTotal,
      total,
      notes: input.notes,
      ctx,
    });
  }

  async getTerminalSession(user: AuthenticatedUser, sessionId: string) {
    const session = await this.readSession(sessionId);
    if (!session) throw Errors.notFound('Terminal session');
    this.branchAccess.assertCanAccess(user, session.branchId);
    return session;
  }

  async approveTerminal(
    user: AuthenticatedUser,
    sessionId: string,
    input: PosTerminalActionInput,
    ctx: RequestContext,
  ) {
    const session = await this.readSession(sessionId);
    if (!session) throw Errors.notFound('Terminal session');
    this.branchAccess.assertCanAccess(user, session.branchId);
    if (session.status !== 'AWAITING_CARD') {
      throw Errors.conflict('TERMINAL_NOT_AWAITING', `Terminal is ${session.status}, not awaiting card.`);
    }

    const summary = {
      type: 'card',
      brand: input.cardBrand ?? 'visa',
      last4: input.last4 ?? '4242',
      channel: 'pos',
    };

    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: session.paymentId } });
      if (payment.status === 'SUCCEEDED') return;

      const order = await tx.order.findUniqueOrThrow({
        where: { id: session.orderId },
        include: { items: true },
      });
      if (order.status !== 'PAYMENT_PENDING' && order.status !== 'PENDING') {
        throw Errors.conflict('ORDER_NOT_PENDING', 'Order is no longer awaiting payment.');
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
          paymentMethodSummary: summary as Prisma.InputJsonValue,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, from: order.status, to: 'PAID', isSystem: true, notes: 'POS card approved' },
      });

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
    });

    const updated: TerminalSession = {
      ...session,
      status: 'APPROVED',
      updatedAt: new Date().toISOString(),
      paymentMethodSummary: summary,
    };
    await this.writeSession(updated);

    await this.audit.log({
      actorUserId: user.id,
      branchId: session.branchId,
      action: 'POS_CARD_APPROVED',
      resourceType: 'Order',
      resourceId: session.orderId,
      metadata: { orderNumber: session.orderNumber, amount: session.amount, sessionId },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    await this.notifications.queueOrderEvent('payment.succeeded', session.orderId);

    return updated;
  }

  async declineTerminal(
    user: AuthenticatedUser,
    sessionId: string,
    input: PosTerminalActionInput,
    ctx: RequestContext,
  ) {
    const session = await this.readSession(sessionId);
    if (!session) throw Errors.notFound('Terminal session');
    this.branchAccess.assertCanAccess(user, session.branchId);
    if (session.status !== 'AWAITING_CARD') {
      throw Errors.conflict('TERMINAL_NOT_AWAITING', `Terminal is ${session.status}, not awaiting card.`);
    }

    const reason = input.reason?.trim() || 'Card declined at POS terminal';
    await this.cancelPendingSale(session.orderId, session.paymentId, reason);

    const updated: TerminalSession = {
      ...session,
      status: 'DECLINED',
      failureReason: reason,
      updatedAt: new Date().toISOString(),
    };
    await this.writeSession(updated);

    await this.audit.log({
      actorUserId: user.id,
      branchId: session.branchId,
      action: 'POS_CARD_DECLINED',
      resourceType: 'Order',
      resourceId: session.orderId,
      metadata: { orderNumber: session.orderNumber, sessionId, reason },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    await this.notifications.queueOrderEvent('payment.failed', session.orderId);

    return updated;
  }

  async cancelTerminal(user: AuthenticatedUser, sessionId: string, ctx: RequestContext) {
    const session = await this.readSession(sessionId);
    if (!session) throw Errors.notFound('Terminal session');
    this.branchAccess.assertCanAccess(user, session.branchId);
    if (session.status !== 'AWAITING_CARD') {
      throw Errors.conflict('TERMINAL_NOT_AWAITING', `Terminal is ${session.status}, cannot cancel.`);
    }

    const reason = 'POS card payment cancelled by staff';
    await this.cancelPendingSale(session.orderId, session.paymentId, reason);

    const updated: TerminalSession = {
      ...session,
      status: 'CANCELLED',
      failureReason: reason,
      updatedAt: new Date().toISOString(),
    };
    await this.writeSession(updated);

    await this.audit.log({
      actorUserId: user.id,
      branchId: session.branchId,
      action: 'POS_CARD_CANCELLED',
      resourceType: 'Order',
      resourceId: session.orderId,
      metadata: { orderNumber: session.orderNumber, sessionId },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });

    return updated;
  }

  private async completeCashSale(params: {
    user: AuthenticatedUser;
    branch: { id: string; currency: string; taxRateBps: number; name: string };
    customer: { id: string; email: string };
    lines: ResolvedLine[];
    subtotal: number;
    taxTotal: number;
    total: number;
    notes?: string;
    amountTendered?: number;
    ctx: RequestContext;
  }) {
    const { user, branch, customer, lines, subtotal, taxTotal, total, notes, amountTendered, ctx } =
      params;

    const order = await this.prisma.$transaction(async (tx) => {
      const seqRows = await tx.$queryRaw<Array<{ n: bigint | number }>>`
        SELECT nextval('order_number_seq') AS n
      `;
      const orderNumber = `ORD-${String(Number(seqRows[0]?.n ?? 0)).padStart(6, '0')}`;

      for (const line of lines) {
        const reserved = await this.inventory.reserveWithinTx(tx, {
          branchId: branch.id,
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          reference: orderNumber,
        });
        if (!reserved) throw Errors.insufficientStock(line.sku);
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          branchId: branch.id,
          customerId: customer.id,
          status: 'PAID',
          source: 'CASH',
          fulfilmentType: 'CLICK_AND_COLLECT',
          contactEmail: customer.email,
          subtotal,
          discountTotal: 0,
          taxTotal,
          deliveryFee: 0,
          total,
          currency: branch.currency,
          notes: notes ?? null,
          paidAt: new Date(),
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              productName: line.productName,
              variantName: line.variantName,
              sku: line.sku,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              originalUnitPrice: line.originalUnitPrice,
              lineTotal: line.lineTotal,
              taxAmount: line.taxAmount,
            })),
          },
          statusHistory: {
            create: [
              { to: 'PAYMENT_PENDING', isSystem: true },
              { to: 'PAID', isSystem: true, notes: 'Cash payment at till' },
            ],
          },
        },
        include: { items: true },
      });

      for (const item of created.items) {
        await this.inventory.commitSaleWithinTx(tx, {
          branchId: branch.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          reference: orderNumber,
        });
      }

      await tx.payment.create({
        data: {
          orderId: created.id,
          status: 'SUCCEEDED',
          provider: 'cash',
          providerPaymentId: `cash_${created.id}`,
          amount: total,
          currency: branch.currency,
          paymentMethodSummary: {
            type: 'cash',
            amountTendered: amountTendered ?? total,
            change: amountTendered != null ? Math.max(0, amountTendered - total) : 0,
          } as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    await this.audit.log({
      actorUserId: user.id,
      branchId: branch.id,
      action: 'POS_CASH_SALE',
      resourceType: 'Order',
      resourceId: order.id,
      metadata: { orderNumber: order.orderNumber, total, itemCount: lines.length },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    await this.notifications.queueOrderEvent('payment.succeeded', order.id);

    const change =
      amountTendered != null ? Math.max(0, amountTendered - total) : undefined;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'PAID' as const,
      paymentType: 'CASH' as const,
      source: 'CASH' as const,
      total,
      currency: branch.currency,
      change,
      amountTendered,
      terminalSessionId: null as string | null,
      terminalDisplayPath: null as string | null,
    };
  }

  private async startCardSale(params: {
    user: AuthenticatedUser;
    branch: { id: string; currency: string; taxRateBps: number; name: string };
    customer: { id: string; email: string };
    lines: ResolvedLine[];
    subtotal: number;
    taxTotal: number;
    total: number;
    notes?: string;
    ctx: RequestContext;
  }) {
    const { user, branch, customer, lines, subtotal, taxTotal, total, notes, ctx } = params;
    const sessionId = randomUUID();

    const order = await this.prisma.$transaction(async (tx) => {
      const seqRows = await tx.$queryRaw<Array<{ n: bigint | number }>>`
        SELECT nextval('order_number_seq') AS n
      `;
      const orderNumber = `ORD-${String(Number(seqRows[0]?.n ?? 0)).padStart(6, '0')}`;

      for (const line of lines) {
        const reserved = await this.inventory.reserveWithinTx(tx, {
          branchId: branch.id,
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          reference: orderNumber,
        });
        if (!reserved) throw Errors.insufficientStock(line.sku);
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          branchId: branch.id,
          customerId: customer.id,
          status: 'PAYMENT_PENDING',
          source: 'POS',
          fulfilmentType: 'CLICK_AND_COLLECT',
          contactEmail: customer.email,
          subtotal,
          discountTotal: 0,
          taxTotal,
          deliveryFee: 0,
          total,
          currency: branch.currency,
          notes: notes ?? null,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              productName: line.productName,
              variantName: line.variantName,
              sku: line.sku,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              originalUnitPrice: line.originalUnitPrice,
              lineTotal: line.lineTotal,
              taxAmount: line.taxAmount,
            })),
          },
          statusHistory: { create: [{ to: 'PAYMENT_PENDING', isSystem: true, notes: 'Awaiting POS card' }] },
          reservations: {
            create: lines.map((line) => ({
              branchId: branch.id,
              productId: line.productId,
              variantId: line.variantId,
              quantity: line.quantity,
              expiresAt: new Date(Date.now() + TERMINAL_TTL_SEC * 1000),
            })),
          },
        },
      });

      await tx.payment.create({
        data: {
          orderId: created.id,
          status: 'REQUIRES_ACTION',
          provider: 'pos',
          providerPaymentId: `pos_term_${sessionId}`,
          amount: total,
          currency: branch.currency,
          paymentMethodSummary: { type: 'card', channel: 'pos', terminalSessionId: sessionId },
        },
      });

      return created;
    });

    const payment = await this.prisma.payment.findFirstOrThrow({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
    });

    const session: TerminalSession = {
      sessionId,
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      branchId: branch.id,
      branchName: branch.name,
      amount: total,
      currency: branch.currency,
      status: 'AWAITING_CARD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.writeSession(session);

    await this.audit.log({
      actorUserId: user.id,
      branchId: branch.id,
      action: 'POS_CARD_SESSION_STARTED',
      resourceType: 'Order',
      resourceId: order.id,
      metadata: { orderNumber: order.orderNumber, total, sessionId },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    await this.notifications.queueOrderEvent('order.created', order.id);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'PAYMENT_PENDING' as const,
      paymentType: 'CARD' as const,
      source: 'POS' as const,
      total,
      currency: branch.currency,
      change: undefined as number | undefined,
      amountTendered: undefined as number | undefined,
      terminalSessionId: sessionId,
      terminalDisplayPath: `/pos/terminal/${sessionId}`,
    };
  }

  private async cancelPendingSale(orderId: string, paymentId: string, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.status === 'SUCCEEDED' || payment.status === 'CANCELLED') return;

      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'FAILED', failureReason: reason },
      });

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order || (order.status !== 'PAYMENT_PENDING' && order.status !== 'PENDING')) return;

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
        where: { orderId, status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, from: order.status, to: 'CANCELLED', isSystem: true, notes: reason },
      });
    });
  }

  private async resolveLines(
    branchId: string,
    taxRateBps: number,
    items: PosSaleInput['items'],
  ): Promise<ResolvedLine[]> {
    const qtyByVariant = new Map<string, number>();
    for (const item of items) {
      qtyByVariant.set(item.variantId, (qtyByVariant.get(item.variantId) ?? 0) + item.quantity);
    }

    const variantIds = [...qtyByVariant.keys()];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, deletedAt: null, status: 'ACTIVE' },
      include: { product: true },
    });
    if (variants.length !== variantIds.length) {
      throw Errors.badRequest('UNKNOWN_VARIANT', 'One or more products are invalid.');
    }

    const branchProducts = await this.prisma.branchProduct.findMany({
      where: { branchId, variantId: { in: variantIds } },
    });
    const bpByVariant = new Map(branchProducts.map((bp) => [bp.variantId, bp]));

    const lines: ResolvedLine[] = [];
    for (const variant of variants) {
      const bp = bpByVariant.get(variant.id);
      if (!bp || !bp.isAvailable) {
        throw Errors.badRequest(
          'UNAVAILABLE_AT_BRANCH',
          `${variant.product.name} is not available at this branch.`,
        );
      }
      const quantity = qtyByVariant.get(variant.id)!;
      const unitPrice = bp.salePrice ?? bp.sellingPrice;
      const lineTotal = unitPrice * quantity;
      const taxAmount = Math.round((lineTotal * taxRateBps) / (10000 + taxRateBps));
      lines.push({
        productId: variant.productId,
        variantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.sku,
        quantity,
        unitPrice,
        originalUnitPrice: bp.sellingPrice,
        lineTotal,
        taxAmount,
      });
    }
    return lines;
  }

  private async ensureWalkInCustomer() {
    const existing = await this.prisma.customer.findUnique({ where: { email: WALK_IN_EMAIL } });
    if (existing) return existing;

    try {
      return await this.prisma.customer.create({
        data: {
          email: WALK_IN_EMAIL,
          passwordHash: await hashPassword(`pos-walk-in-${randomUUID()}`),
          firstName: 'Walk-in',
          lastName: 'Customer',
          isActive: true,
          marketingOptIn: false,
          emailVerifiedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(`Walk-in customer create raced: ${String(err)}`);
      return this.prisma.customer.findUniqueOrThrow({ where: { email: WALK_IN_EMAIL } });
    }
  }

  private async readSession(sessionId: string): Promise<TerminalSession | null> {
    const raw = await this.redis.get(TERMINAL_KEY(sessionId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TerminalSession;
    } catch {
      return null;
    }
  }

  private async writeSession(session: TerminalSession): Promise<void> {
    await this.redis.set(TERMINAL_KEY(session.sessionId), JSON.stringify(session), 'EX', TERMINAL_TTL_SEC);
  }
}
