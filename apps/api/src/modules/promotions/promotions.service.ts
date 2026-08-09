import { Injectable } from '@nestjs/common';
import type { PromotionStatus } from '@repo/database';
import type { CreateCouponInput, CreatePromotionInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  async list(user: AuthenticatedUser, params: { page: number; pageSize: number; status?: PromotionStatus }) {
    const where = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(user.isGlobal
        ? {}
        : { OR: [{ allBranches: true }, { branches: { some: { branchId: { in: [...user.branchIds] } } } }] }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.promotion.findMany({
        where,
        include: {
          branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
          products: { include: { product: { select: { id: true, name: true, sku: true } } } },
          categories: { include: { category: { select: { id: true, name: true } } } },
          coupons: true,
        },
        orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.promotion.count({ where }),
    ]);
    return { items, total, page: params.page, pageSize: params.pageSize, totalPages: Math.ceil(total / params.pageSize) };
  }

  async create(user: AuthenticatedUser, input: CreatePromotionInput, ctx: RequestContext) {
    const { branchIds, productIds, categoryIds, ...data } = input;
    // Branch-scoped users may only create promotions for their own branches.
    if (branchIds.length > 0) this.branchAccess.assertCanAccessAll(user, branchIds);
    if (branchIds.length === 0 && !user.isGlobal) {
      throw Errors.forbidden('Only HQ users can create promotions that apply to all branches.');
    }

    const promotion = await this.prisma.promotion.create({
      data: {
        ...data,
        allBranches: branchIds.length === 0,
        branches: { create: branchIds.map((branchId) => ({ branchId })) },
        products: { create: productIds.map((productId) => ({ productId })) },
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
      include: { branches: true, products: true, categories: true },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'PROMOTION_CREATED',
      resourceType: 'Promotion',
      resourceId: promotion.id,
      newValue: { name: input.name, type: input.type, value: input.value },
      requestId: ctx.requestId,
    });
    return promotion;
  }

  async setStatus(user: AuthenticatedUser, id: string, status: PromotionStatus, ctx: RequestContext) {
    const existing = await this.prisma.promotion.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw Errors.notFound('Promotion');
    const promotion = await this.prisma.promotion.update({
      where: { id },
      data: { status, ...(status === 'ARCHIVED' ? { deletedAt: new Date() } : {}) },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'PROMOTION_STATUS_CHANGED',
      resourceType: 'Promotion',
      resourceId: id,
      oldValue: { status: existing.status },
      newValue: { status },
      requestId: ctx.requestId,
    });
    return promotion;
  }

  async createCoupon(user: AuthenticatedUser, input: CreateCouponInput, ctx: RequestContext) {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id: input.promotionId, deletedAt: null },
    });
    if (!promotion) throw Errors.notFound('Promotion');
    const existing = await this.prisma.coupon.findUnique({ where: { code: input.code } });
    if (existing) throw Errors.conflict('COUPON_EXISTS', 'A coupon with this code already exists.');

    const coupon = await this.prisma.coupon.create({ data: input });
    await this.audit.log({
      actorUserId: user.id,
      action: 'COUPON_CREATED',
      resourceType: 'Coupon',
      resourceId: coupon.id,
      newValue: { code: coupon.code, promotionId: coupon.promotionId },
      requestId: ctx.requestId,
    });
    return coupon;
  }

  async listCoupons(params: { page: number; pageSize: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({
        include: { promotion: { select: { id: true, name: true, type: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.coupon.count(),
    ]);
    return { items, total, page: params.page, pageSize: params.pageSize, totalPages: Math.ceil(total / params.pageSize) };
  }
}
