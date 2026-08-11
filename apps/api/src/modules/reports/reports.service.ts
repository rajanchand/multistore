import { Injectable } from '@nestjs/common';
import { Prisma, type OrderStatus } from '@repo/database';
import type { ReportKind, SendReportInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { AnalyticsService, type AnalyticsRange } from '../analytics/analytics.service';
import { AuditService } from '../audit/audit.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';
import { buildReportPdf } from './report-pdf';
import {
  createEmailProviderFromEnv,
  type EmailProvider,
} from '../notifications/email-provider';

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

const REPORT_RECIPIENT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'MARKETING'] as const;

@Injectable()
export class ReportsService {
  private emailProviderPromise: Promise<EmailProvider> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchAccess: BranchAccessService,
    private readonly analytics: AnalyticsService,
    private readonly audit: AuditService,
  ) {}

  private emailProvider(): Promise<EmailProvider> {
    if (!this.emailProviderPromise) {
      this.emailProviderPromise = createEmailProviderFromEnv();
    }
    return this.emailProviderPromise;
  }

  async hqSummary(user: AuthenticatedUser, range: AnalyticsRange) {
    const [overview, revenueByBranch, topProducts, inventory, orderStatus] = await Promise.all([
      this.analytics.overview(user, range),
      this.analytics.revenueByBranch(user, range),
      this.analytics.topProducts(user, range, 15),
      this.inventoryReport(user, range.branchIds),
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

  async inventoryReport(user: AuthenticatedUser, requestedBranchIds?: string[]) {
    const branchIds = this.branchAccess.resolveScope(user, requestedBranchIds);
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

  async loadReport(
    kind: ReportKind,
    user: AuthenticatedUser,
    range: AnalyticsRange,
  ): Promise<Record<string, unknown>> {
    switch (kind) {
      case 'summary':
        return this.hqSummary(user, range) as Promise<Record<string, unknown>>;
      case 'sales':
        return this.salesReport(user, range) as Promise<Record<string, unknown>>;
      case 'orders':
        return this.ordersReport(user, range) as Promise<Record<string, unknown>>;
      case 'inventory':
        return this.inventoryReport(user, range.branchIds) as Promise<Record<string, unknown>>;
      default:
        throw Errors.badRequest('INVALID_REPORT', 'Unknown report kind.');
    }
  }

  async buildPdf(
    kind: ReportKind,
    user: AuthenticatedUser,
    range: AnalyticsRange,
    rangeKey?: string,
    note?: string,
  ) {
    const payload = await this.loadReport(kind, user, range);
    return buildReportPdf(kind, payload, { rangeKey, note });
  }

  async recipients(user: AuthenticatedUser) {
    const scope = this.branchAccess.resolveScope(user);
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        roles: { some: { role: { name: { in: [...REPORT_RECIPIENT_ROLES] } } } },
        ...(user.isGlobal || !scope
          ? {}
          : {
              OR: [
                { isGlobal: true },
                { branches: { some: { branchId: { in: scope } } } },
              ],
            }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roles: { select: { role: { select: { name: true } } } },
        branches: { select: { branch: { select: { id: true, name: true, code: true } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 200,
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: `${u.firstName} ${u.lastName}`.trim(),
      roles: u.roles.map((r) => r.role.name),
      branches: u.branches.map((b) => b.branch),
    }));
  }

  async sendReport(
    kind: ReportKind,
    user: AuthenticatedUser,
    range: AnalyticsRange,
    input: SendReportInput,
    rangeKey: string,
    ctx: RequestContext,
  ) {
    const staff =
      input.userIds.length > 0
        ? await this.prisma.user.findMany({
            where: {
              id: { in: input.userIds },
              deletedAt: null,
              isActive: true,
            },
            select: { id: true, email: true },
          })
        : [];

    if (input.userIds.length > 0 && staff.length !== input.userIds.length) {
      throw Errors.badRequest('INVALID_RECIPIENTS', 'One or more staff recipients were not found.');
    }

    const emails = [
      ...new Set(
        [...staff.map((s) => s.email.toLowerCase()), ...input.emails.map((e) => e.toLowerCase())].filter(
          Boolean,
        ),
      ),
    ];
    if (emails.length === 0) {
      throw Errors.badRequest('NO_RECIPIENTS', 'Provide at least one recipient email.');
    }
    if (emails.length > 20) {
      throw Errors.badRequest('TOO_MANY_RECIPIENTS', 'At most 20 recipients allowed.');
    }

    const { buffer, filename } = await this.buildPdf(kind, user, range, rangeKey, input.note);
    const provider = await this.emailProvider();
    const subject = `MultiBranch ${kind} report (${rangeKey})`;
    const text = [
      `Please find attached the ${kind} report.`,
      `Period key: ${rangeKey}`,
      `Generated: ${new Date().toISOString()}`,
      input.note ? `Note: ${input.note}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const results: Array<{ email: string; messageId: string; provider: string }> = [];
    for (const to of emails) {
      const result = await provider.send({
        to,
        subject,
        text,
        attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
      });
      results.push({ email: to, messageId: result.messageId, provider: result.provider });
    }

    await this.audit.log({
      actorUserId: user.id,
      action: 'REPORT_EMAILED',
      resourceType: 'Report',
      resourceId: kind,
      newValue: {
        kind,
        rangeKey,
        recipientCount: results.length,
        emails: results.map((r) => r.email),
        provider: results[0]?.provider,
        filename,
      },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });

    return {
      sent: results.length,
      filename,
      provider: results[0]?.provider ?? provider.name,
      recipients: results,
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
