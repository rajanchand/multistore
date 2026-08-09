import { Injectable } from '@nestjs/common';
import type { CreateBannerInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  async list(user: AuthenticatedUser) {
    return this.prisma.banner.findMany({
      where: {
        deletedAt: null,
        ...(user.isGlobal
          ? {}
          : { OR: [{ isGlobal: true }, { branches: { some: { branchId: { in: [...user.branchIds] } } } }] }),
      },
      include: {
        branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async get(user: AuthenticatedUser, id: string) {
    const banner = await this.prisma.banner.findFirst({
      where: { id, deletedAt: null },
      include: {
        branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
      },
    });
    if (!banner) throw Errors.notFound('Banner');
    if (
      !user.isGlobal &&
      !banner.isGlobal &&
      !banner.branches.some((b) => user.branchIds.has(b.branchId))
    ) {
      throw Errors.forbidden();
    }
    return banner;
  }

  async create(user: AuthenticatedUser, input: CreateBannerInput, ctx: RequestContext) {
    const { branchIds, ...raw } = input;
    const data = {
      ...raw,
      image: raw.image || null,
      mobileImage: raw.mobileImage || null,
      ctaLabel: raw.ctaLabel || null,
      ctaUrl: raw.ctaUrl || null,
      body: raw.body || null,
    };
    if (branchIds.length > 0) this.branchAccess.assertCanAccessAll(user, branchIds);
    if (!input.isGlobal && branchIds.length === 0) {
      throw Errors.badRequest('BRANCHES_REQUIRED', 'Select branches or mark the banner as global.');
    }
    if (input.isGlobal && !user.isGlobal) {
      throw Errors.forbidden('Only HQ users can create global banners.');
    }

    const banner = await this.prisma.banner.create({
      data: {
        ...data,
        isGlobal: input.isGlobal,
        branches: { create: branchIds.map((branchId) => ({ branchId })) },
      },
      include: {
        branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'BANNER_CREATED',
      resourceType: 'Banner',
      resourceId: banner.id,
      newValue: { title: banner.title, type: banner.type },
      requestId: ctx.requestId,
    });
    return banner;
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    input: Partial<CreateBannerInput>,
    ctx: RequestContext,
  ) {
    const existing = await this.get(user, id);
    if (existing.isGlobal && !user.isGlobal) {
      throw Errors.forbidden('Only HQ users can edit global banners.');
    }
    if (
      !user.isGlobal &&
      !existing.isGlobal &&
      !existing.branches.some((b) => user.branchIds.has(b.branchId))
    ) {
      throw Errors.branchAccessDenied();
    }

    const { branchIds, ...raw } = input;
    if (branchIds) this.branchAccess.assertCanAccessAll(user, branchIds);
    if (input.isGlobal === true && !user.isGlobal) {
      throw Errors.forbidden('Only HQ users can mark banners as global.');
    }
    if (input.isGlobal === false && branchIds && branchIds.length === 0) {
      throw Errors.badRequest('BRANCHES_REQUIRED', 'Select branches or mark the banner as global.');
    }

    const data = {
      ...raw,
      ...(raw.image !== undefined ? { image: raw.image || null } : {}),
      ...(raw.mobileImage !== undefined ? { mobileImage: raw.mobileImage || null } : {}),
      ...(raw.ctaLabel !== undefined ? { ctaLabel: raw.ctaLabel || null } : {}),
      ...(raw.ctaUrl !== undefined ? { ctaUrl: raw.ctaUrl || null } : {}),
      ...(raw.body !== undefined ? { body: raw.body || null } : {}),
    };

    const banner = await this.prisma.$transaction(async (tx) => {
      if (branchIds) {
        await tx.bannerBranch.deleteMany({ where: { bannerId: id } });
        await tx.bannerBranch.createMany({
          data: branchIds.map((branchId) => ({ bannerId: id, branchId })),
        });
      }
      return tx.banner.update({
        where: { id },
        data,
        include: { branches: { include: { branch: { select: { id: true, name: true, code: true } } } } },
      });
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'BANNER_UPDATED',
      resourceType: 'Banner',
      resourceId: id,
      newValue: input,
      requestId: ctx.requestId,
    });
    return banner;
  }

  async archive(user: AuthenticatedUser, id: string, ctx: RequestContext) {
    const existing = await this.get(user, id);
    if (existing.isGlobal && !user.isGlobal) {
      throw Errors.forbidden('Only HQ users can archive global banners.');
    }
    const banner = await this.prisma.banner.update({
      where: { id },
      data: { status: 'ARCHIVED', deletedAt: new Date() },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'BANNER_ARCHIVED',
      resourceType: 'Banner',
      resourceId: id,
      requestId: ctx.requestId,
    });
    return banner;
  }
}
