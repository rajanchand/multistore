import { Injectable } from '@nestjs/common';
import type { OrderSource, OrderStatus, Prisma } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

/** Admin-driven transitions. Payment-driven transitions (PAID etc.) happen in PaymentsService. */
const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAID: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_COLLECTION', 'DISPATCHED', 'CANCELLED'],
  READY_FOR_COLLECTION: ['DELIVERED'],
  DISPATCHED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  RETURN_REQUESTED: [],
};

export interface OrderListQuery {
  page: number;
  pageSize: number;
  branchId?: string;
  status?: OrderStatus;
  source?: OrderSource;
  search?: string;
  customerId?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  async list(user: AuthenticatedUser, query: OrderListQuery) {
    if (query.branchId) this.branchAccess.assertCanAccess(user, query.branchId);
    const where: Prisma.OrderWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : this.branchAccess.branchFilter(user)),
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: 'insensitive' } },
              { contactEmail: { contains: query.search, mode: 'insensitive' } },
              { customer: { lastName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? { placedAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          payments: { select: { id: true, status: true, provider: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { items: true } },
        },
        orderBy: { placedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async getById(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        items: true,
        statusHistory: {
          include: { actor: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
        payments: { include: { refunds: true }, orderBy: { createdAt: 'desc' } },
        refunds: {
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            approvedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        returns: { include: { items: true } },
      },
    });
    if (!order) throw Errors.notFound('Order');
    this.branchAccess.assertCanAccess(user, order.branchId);
    return order;
  }

  async transition(
    user: AuthenticatedUser,
    orderId: string,
    to: OrderStatus,
    notes: string | undefined,
    ctx: RequestContext,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw Errors.notFound('Order');
    this.branchAccess.assertCanAccess(user, order.branchId);

    const allowed = ADMIN_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(to)) {
      throw Errors.invalidTransition(order.status, to);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id: orderId },
        data: { status: to, ...(to === 'CANCELLED' ? { cancelledAt: new Date() } : {}) },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, from: order.status, to, notes, actorUserId: user.id },
      });
      return result;
    });

    await this.audit.log({
      actorUserId: user.id,
      branchId: order.branchId,
      action: 'ORDER_STATUS_UPDATED',
      resourceType: 'Order',
      resourceId: orderId,
      oldValue: { status: order.status },
      newValue: { status: to, notes },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });

    if (to === 'DISPATCHED') await this.notifications.queueOrderEvent('order.dispatched', orderId);
    if (to === 'READY_FOR_COLLECTION') {
      await this.notifications.queueOrderEvent('order.ready_for_collection', orderId);
    }
    return updated;
  }

  // --- Customer-facing ---

  async listForCustomer(customerId: string, page: number, pageSize: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { customerId },
        include: {
          branch: { select: { id: true, name: true } },
          items: { select: { id: true, productName: true, quantity: true, lineTotal: true } },
        },
        orderBy: { placedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where: { customerId } }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getForCustomer(customerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: {
        branch: { select: { id: true, name: true, addressLine1: true, city: true, postcode: true } },
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' }, select: { to: true, createdAt: true, notes: true } },
        payments: { select: { status: true, amount: true, currency: true, paymentMethodSummary: true } },
      },
    });
    if (!order) throw Errors.notFound('Order');
    return order;
  }

  /** Public order tracking: requires the order number AND matching email. */
  async track(orderNumber: string, email: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, contactEmail: email.toLowerCase() },
      select: {
        orderNumber: true,
        status: true,
        fulfilmentType: true,
        placedAt: true,
        branch: { select: { name: true } },
        statusHistory: { orderBy: { createdAt: 'asc' }, select: { to: true, createdAt: true } },
      },
    });
    if (!order) throw Errors.notFound('Order');
    return order;
  }

  /** Customer return request. */
  async requestReturn(customerId: string, orderId: string, reason: string, items?: { orderItemId: string; quantity: number }[]) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: { items: true },
    });
    if (!order) throw Errors.notFound('Order');
    if (order.status !== 'DELIVERED' && order.status !== 'RETURNED' && order.status !== 'PARTIALLY_REFUNDED') {
      throw Errors.conflict('NOT_RETURNABLE', 'Only delivered orders can be returned.');
    }

    const returnItems = (items && items.length > 0
      ? items
      : order.items.map((i) => ({ orderItemId: i.id, quantity: i.quantity }))
    ).filter((ri) => order.items.some((oi) => oi.id === ri.orderItemId));

    const count = await this.prisma.return.count();
    const created = await this.prisma.$transaction(async (tx) => {
      const ret = await tx.return.create({
        data: {
          number: `RET-${String(count + 1).padStart(6, '0')}`,
          orderId,
          reason,
          items: { create: returnItems },
        },
        include: { items: true },
      });
      await tx.order.update({ where: { id: orderId }, data: { status: 'RETURN_REQUESTED' } });
      await tx.orderStatusHistory.create({
        data: { orderId, from: order.status, to: 'RETURN_REQUESTED', isSystem: true, notes: reason },
      });
      return ret;
    });
    return created;
  }
}
