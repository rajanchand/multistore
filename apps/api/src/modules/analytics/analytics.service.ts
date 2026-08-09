import { Injectable } from '@nestjs/common';
import { Prisma, type OrderStatus } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import type { AuthenticatedUser } from '../../common/auth-context';

const REVENUE_STATUSES: OrderStatus[] = [
  'PAID',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_COLLECTION',
  'DISPATCHED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'PARTIALLY_REFUNDED',
];

export interface AnalyticsRange {
  from: Date;
  to: Date;
  branchIds?: string[];
}

/**
 * Dashboard analytics. All metrics are computed with database aggregation
 * (groupBy / aggregate / raw GROUP BY) — orders are never loaded into memory.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  /** Resolve+authorise branch scope, then build the common order filter. */
  private scope(user: AuthenticatedUser, range: AnalyticsRange): Prisma.OrderWhereInput {
    const branchIds = this.branchAccess.resolveScope(user, range.branchIds);
    return {
      placedAt: { gte: range.from, lte: range.to },
      ...(branchIds ? { branchId: { in: branchIds } } : {}),
    };
  }

  async overview(user: AuthenticatedUser, range: AnalyticsRange) {
    const where = this.scope(user, range);
    const revenueWhere = { ...where, status: { in: REVENUE_STATUSES } };

    const [revenue, orders, customers, refunds, lowStock] = await Promise.all([
      this.prisma.order.aggregate({ where: revenueWhere, _sum: { total: true }, _count: true }),
      this.prisma.order.count({ where }),
      this.prisma.order
        .groupBy({ by: ['customerId'], where })
        .then((rows) => rows.length),
      this.prisma.refund.aggregate({
        where: {
          status: 'SUCCEEDED',
          createdAt: { gte: range.from, lte: range.to },
          order: where.branchId ? { branchId: where.branchId } : {},
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "Inventory" i
        WHERE i."available" <= i."lowStockThreshold"
        ${
          where.branchId && 'in' in (where.branchId as object)
            ? Prisma.sql`AND i."branchId" IN (${Prisma.join((where.branchId as { in: string[] }).in)})`
            : Prisma.empty
        }
      `.then((rows) => Number(rows[0]?.count ?? 0)),
    ]);

    const paidOrderCount = revenue._count;
    const totalRevenue = revenue._sum.total ?? 0;
    return {
      totalRevenue,
      orders,
      paidOrders: paidOrderCount,
      customers,
      averageOrderValue: paidOrderCount > 0 ? Math.round(totalRevenue / paidOrderCount) : 0,
      refundsTotal: refunds._sum.amount ?? 0,
      refundsCount: refunds._count,
      refundRateBps: totalRevenue > 0 ? Math.round(((refunds._sum.amount ?? 0) * 10000) / totalRevenue) : 0,
      lowStockCount: lowStock,
    };
  }

  /** Daily revenue/order trend via SQL date_trunc GROUP BY. */
  async revenueTrend(user: AuthenticatedUser, range: AnalyticsRange) {
    const branchIds = this.branchAccess.resolveScope(user, range.branchIds);
    const rows = await this.prisma.$queryRaw<
      { day: Date; revenue: bigint; orders: bigint }[]
    >`
      SELECT date_trunc('day', o."placedAt") AS day,
             COALESCE(SUM(o."total"), 0)::bigint AS revenue,
             COUNT(*)::bigint AS orders
      FROM "Order" o
      WHERE o."placedAt" BETWEEN ${range.from} AND ${range.to}
        AND o."status"::text = ANY(${REVENUE_STATUSES.map(String)})
        ${branchIds ? Prisma.sql`AND o."branchId" IN (${Prisma.join(branchIds)})` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      revenue: Number(r.revenue),
      orders: Number(r.orders),
    }));
  }

  async revenueByBranch(user: AuthenticatedUser, range: AnalyticsRange) {
    const where = { ...this.scope(user, range), status: { in: REVENUE_STATUSES } };
    const rows = await this.prisma.order.groupBy({
      by: ['branchId'],
      where,
      _sum: { total: true },
      _count: true,
    });
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: rows.map((r) => r.branchId) } },
      select: { id: true, name: true, code: true },
    });
    const branchById = new Map(branches.map((b) => [b.id, b]));
    return rows
      .map((r) => ({
        branch: branchById.get(r.branchId) ?? { id: r.branchId, name: 'Unknown', code: '?' },
        revenue: r._sum.total ?? 0,
        orders: r._count,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async topProducts(user: AuthenticatedUser, range: AnalyticsRange, limit = 10) {
    const branchIds = this.branchAccess.resolveScope(user, range.branchIds);
    const rows = await this.prisma.$queryRaw<
      { productId: string; productName: string; units: bigint; revenue: bigint }[]
    >`
      SELECT oi."productId", MAX(oi."productName") AS "productName",
             SUM(oi."quantity")::bigint AS units,
             SUM(oi."lineTotal")::bigint AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."placedAt" BETWEEN ${range.from} AND ${range.to}
        AND o."status"::text = ANY(${REVENUE_STATUSES.map(String)})
        ${branchIds ? Prisma.sql`AND o."branchId" IN (${Prisma.join(branchIds)})` : Prisma.empty}
      GROUP BY oi."productId"
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      units: Number(r.units),
      revenue: Number(r.revenue),
    }));
  }

  async salesByCategory(user: AuthenticatedUser, range: AnalyticsRange) {
    const branchIds = this.branchAccess.resolveScope(user, range.branchIds);
    const rows = await this.prisma.$queryRaw<
      { categoryId: string; categoryName: string; revenue: bigint; units: bigint }[]
    >`
      SELECT c."id" AS "categoryId", c."name" AS "categoryName",
             SUM(oi."lineTotal")::bigint AS revenue,
             SUM(oi."quantity")::bigint AS units
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "ProductCategory" pc ON pc."productId" = oi."productId"
      JOIN "Category" c ON c."id" = pc."categoryId"
      WHERE o."placedAt" BETWEEN ${range.from} AND ${range.to}
        AND o."status"::text = ANY(${REVENUE_STATUSES.map(String)})
        ${branchIds ? Prisma.sql`AND o."branchId" IN (${Prisma.join(branchIds)})` : Prisma.empty}
      GROUP BY c."id", c."name"
      ORDER BY revenue DESC
    `;
    return rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      revenue: Number(r.revenue),
      units: Number(r.units),
    }));
  }

  /** Branch performance table + comparison. */
  async branchPerformance(user: AuthenticatedUser, range: AnalyticsRange) {
    const branchIds = this.branchAccess.resolveScope(user, range.branchIds);
    const branches = await this.prisma.branch.findMany({
      where: {
        deletedAt: null,
        code: { not: 'HQ' },
        ...(branchIds ? { id: { in: branchIds } } : {}),
      },
      select: { id: true, name: true, code: true, city: true, isActive: true },
    });

    const [revenueRows, customerRows, refundRows, lowStockRows] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['branchId'],
        where: {
          placedAt: { gte: range.from, lte: range.to },
          status: { in: REVENUE_STATUSES },
          branchId: { in: branches.map((b) => b.id) },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.$queryRaw<{ branchId: string; customers: bigint }[]>`
        SELECT o."branchId", COUNT(DISTINCT o."customerId")::bigint AS customers
        FROM "Order" o
        WHERE o."placedAt" BETWEEN ${range.from} AND ${range.to}
          AND o."branchId" IN (${Prisma.join(branches.map((b) => b.id))})
        GROUP BY o."branchId"
      `,
      this.prisma.$queryRaw<{ branchId: string; refunded: bigint }[]>`
        SELECT o."branchId", COALESCE(SUM(r."amount"), 0)::bigint AS refunded
        FROM "Refund" r
        JOIN "Order" o ON o."id" = r."orderId"
        WHERE r."status" = 'SUCCEEDED'
          AND r."createdAt" BETWEEN ${range.from} AND ${range.to}
          AND o."branchId" IN (${Prisma.join(branches.map((b) => b.id))})
        GROUP BY o."branchId"
      `,
      this.prisma.$queryRaw<{ branchId: string; lowstock: bigint }[]>`
        SELECT i."branchId", COUNT(*)::bigint AS lowstock
        FROM "Inventory" i
        WHERE i."available" <= i."lowStockThreshold"
          AND i."branchId" IN (${Prisma.join(branches.map((b) => b.id))})
        GROUP BY i."branchId"
      `,
    ]);

    const revenueByBranch = new Map(revenueRows.map((r) => [r.branchId, r]));
    const customersByBranch = new Map(customerRows.map((r) => [r.branchId, Number(r.customers)]));
    const refundsByBranch = new Map(refundRows.map((r) => [r.branchId, Number(r.refunded)]));
    const lowStockByBranch = new Map(lowStockRows.map((r) => [r.branchId, Number(r.lowstock)]));

    return branches
      .map((branch) => {
        const rev = revenueByBranch.get(branch.id);
        const revenue = rev?._sum.total ?? 0;
        const orders = rev?._count ?? 0;
        const refunded = refundsByBranch.get(branch.id) ?? 0;
        return {
          branch,
          revenue,
          orders,
          customers: customersByBranch.get(branch.id) ?? 0,
          averageOrderValue: orders > 0 ? Math.round(revenue / orders) : 0,
          refundRateBps: revenue > 0 ? Math.round((refunded * 10000) / revenue) : 0,
          lowStockCount: lowStockByBranch.get(branch.id) ?? 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  async paymentMethodDistribution(user: AuthenticatedUser, range: AnalyticsRange) {
    const branchIds = this.branchAccess.resolveScope(user, range.branchIds);
    const rows = await this.prisma.payment.groupBy({
      by: ['provider', 'status'],
      where: {
        createdAt: { gte: range.from, lte: range.to },
        order: branchIds ? { branchId: { in: branchIds } } : {},
      },
      _count: true,
      _sum: { amount: true },
    });
    return rows.map((r) => ({
      provider: r.provider,
      status: r.status,
      count: r._count,
      amount: r._sum.amount ?? 0,
    }));
  }
}
