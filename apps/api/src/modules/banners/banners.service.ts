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

  async create(user: AuthenticatedUser, input: CreateBannerInput, ctx: RequestContext) {
    const { branchIds, ...data } = input;
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
      include: { branches: true },
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
    const existing = await this.prisma.banner.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw Errors.notFound('Banner');

    const { branchIds, ...data } = input;
    if (branchIds) this.branchAccess.assertCanAccessAll(user, branchIds);

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
    const existing = await this.prisma.banner.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw Errors.notFound('Banner');
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
