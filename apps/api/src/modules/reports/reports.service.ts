import { Injectable } from '@nestjs/common';
import { Prisma, type OrderStatus } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { AnalyticsService, type AnalyticsRange } from '../analytics/analytics.service';
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

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchAccess: BranchAccessService,
    private readonly analytics: AnalyticsService,
  ) {}

  async hqSummary(user: AuthenticatedUser, range: AnalyticsRange) {
    const [overview, revenueByBranch, topProducts, inventory, orderStatus] = await Promise.all([
      this.analytics.overview(user, range),
      this.analytics.revenueByBranch(user, range),
      this.analytics.topProducts(user, range, 15),
      this.inventoryReport(user),
      this.ordersByStatus(user, range),
    ]);
    return {
      range: { from: range.from, to: range.to },
      overview,
      revenueByBranch,
      topProducts,
      inventory,
      orderStatus,
    };
  }

  async salesReport(user: AuthenticatedUser, range: AnalyticsRange) {
    const [overview, revenueTrend, salesByCategory, paymentMethods] = await Promise.all([
      this.analytics.overview(user, range),
      this.analytics.revenueTrend(user, range),
      this.analytics.salesByCategory(user, range),
      this.analytics.paymentMethodDistribution(user, range),
    ]);
    return {
      range: { from: range.from, to: range.to },
      overview,
      revenueTrend,
      salesByCategory,
      paymentMethods,
    };
  }

  async ordersReport(user: AuthenticatedUser, range: AnalyticsRange) {
    const branchIds = this.branchAccess.resolveScope(user, range.branchIds);
    const where: Prisma.OrderWhereInput = {
      placedAt: { gte: range.from, lte: range.to },
      ...(branchIds ? { branchId: { in: branchIds } } : {}),
    };
    const [byStatus, byFulfilment, bySource, recent] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where, _count: true, _sum: { total: true } }),
      this.prisma.order.groupBy({ by: ['fulfilmentType'], where, _count: true }),
      this.prisma.order.groupBy({ by: ['source'], where, _count: true, _sum: { total: true } }),
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          source: true,
          total: true,
          placedAt: true,
          branch: { select: { name: true, code: true } },
          customer: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { placedAt: 'desc' },
        take: 25,
      }),
    ]);
    return {
      range: { from: range.from, to: range.to },
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: r._count,
        total: r._sum.total ?? 0,
      })),
      byFulfilment: byFulfilment.map((r) => ({ type: r.fulfilmentType, count: r._count })),
      bySource: bySource.map((r) => ({
        source: r.source,
        count: r._count,
        total: r._sum.total ?? 0,
      })),
      recent,
    };
  }

  async inventoryReport(user: AuthenticatedUser) {
    const branchIds = this.branchAccess.resolveScope(user);
    const where = branchIds ? { branchId: { in: branchIds } } : {};
    const [totals, byBranch, lowStockRows] = await Promise.all([
      this.prisma.inventory.aggregate({
        where,
        _sum: { available: true, reserved: true, incoming: true },
        _count: true,
      }),
      this.prisma.$queryRaw<
        {
          branchId: string;
          branchName: string;
          branchCode: string;
          skus: bigint;
          available: bigint;
          lowstock: bigint;
        }[]
      >`
        SELECT b."id" AS "branchId", b."name" AS "branchName", b."code" AS "branchCode",
               COUNT(*)::bigint AS skus,
               COALESCE(SUM(i."available"), 0)::bigint AS available,
               COUNT(*) FILTER (WHERE i."available" <= i."lowStockThreshold")::bigint AS lowstock
        FROM "Inventory" i
        JOIN "Branch" b ON b."id" = i."branchId"
        WHERE b."deletedAt" IS NULL
          ${branchIds ? Prisma.sql`AND i."branchId" IN (${Prisma.join(branchIds)})` : Prisma.empty}
        GROUP BY b."id", b."name", b."code"
        ORDER BY b."name"
      `,
      this.prisma.$queryRaw<
        { branchCode: string; sku: string; productName: string; available: number; threshold: number }[]
      >`
        SELECT b."code" AS "branchCode", p."sku", p."name" AS "productName",
               i."available", i."lowStockThreshold" AS threshold
        FROM "Inventory" i
        JOIN "Branch" b ON b."id" = i."branchId"
        JOIN "Product" p ON p."id" = i."productId"
        WHERE i."available" <= i."lowStockThreshold"
          AND b."deletedAt" IS NULL
          ${branchIds ? Prisma.sql`AND i."branchId" IN (${Prisma.join(branchIds)})` : Prisma.empty}
        ORDER BY i."available" ASC
        LIMIT 50
      `,
    ]);

    return {
      totals: {
        skuRows: totals._count,
        available: totals._sum.available ?? 0,
        reserved: totals._sum.reserved ?? 0,
        incoming: totals._sum.incoming ?? 0,
      },
      byBranch: byBranch.map((r) => ({
        branchId: r.branchId,
        branchName: r.branchName,
        branchCode: r.branchCode,
        skus: Number(r.skus),
        available: Number(r.available),
        lowStock: Number(r.lowstock),
      })),
      lowStock: lowStockRows,
    };
  }

  private async ordersByStatus(user: AuthenticatedUser, range: AnalyticsRange) {
    const branchIds = this.branchAccess.resolveScope(user, range.branchIds);
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        placedAt: { gte: range.from, lte: range.to },
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        status: { in: REVENUE_STATUSES },
      },
      _count: true,
    });
    return rows.map((r) => ({ status: r.status, count: r._count }));
  }
}
