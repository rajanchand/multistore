import { Injectable } from '@nestjs/common';
import type { Prisma } from '@repo/database';
import type { CreateCampaignInput, UpdateCampaignInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  list(user: AuthenticatedUser) {
    return this.prisma.campaign.findMany({
      where: {
        deletedAt: null,
        ...(user.isGlobal
          ? {}
          : {
              OR: [
                { branches: { none: {} } },
                { branches: { some: { branchId: { in: [...user.branchIds] } } } },
              ],
            }),
      },
      include: {
        branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { smsMessages: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(user: AuthenticatedUser, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, deletedAt: null },
      include: {
        branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { smsMessages: true } },
      },
    });
    if (!campaign) throw Errors.notFound('Campaign');
    if (!user.isGlobal && campaign.branches.length > 0) {
      this.branchAccess.assertCanAccessAll(
        user,
        campaign.branches.map((b) => b.branchId),
      );
    }
    return campaign;
  }

  async create(user: AuthenticatedUser, input: CreateCampaignInput, ctx: RequestContext) {
    const { branchIds, content, audience, ...data } = input;
    if (branchIds.length > 0) this.branchAccess.assertCanAccessAll(user, branchIds);
    const conflict = await this.prisma.campaign.findFirst({ where: { slug: input.slug } });
    if (conflict) throw Errors.conflict('CAMPAIGN_EXISTS', 'A campaign with this slug already exists.');

    const campaign = await this.prisma.campaign.create({
      data: {
        ...data,
        content: (content ?? undefined) as Prisma.InputJsonValue | undefined,
        audience: (audience ?? undefined) as Prisma.InputJsonValue | undefined,
        createdById: user.id,
        branches: { create: branchIds.map((branchId) => ({ branchId })) },
      },
      include: { branches: true },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'CAMPAIGN_CREATED',
      resourceType: 'Campaign',
      resourceId: campaign.id,
      newValue: { name: campaign.name, channel: campaign.channel },
      requestId: ctx.requestId,
    });
    return campaign;
  }

  async update(user: AuthenticatedUser, id: string, input: UpdateCampaignInput, ctx: RequestContext) {
    await this.getById(user, id);
    const { branchIds, content, audience, ...data } = input;
    if (branchIds) this.branchAccess.assertCanAccessAll(user, branchIds);

    const campaign = await this.prisma.$transaction(async (tx) => {
      if (branchIds) {
        await tx.campaignBranch.deleteMany({ where: { campaignId: id } });
        await tx.campaignBranch.createMany({
          data: branchIds.map((branchId) => ({ campaignId: id, branchId })),
        });
      }
      return tx.campaign.update({
        where: { id },
        data: {
          ...data,
          ...(content !== undefined
            ? { content: content as Prisma.InputJsonValue }
            : {}),
          ...(audience !== undefined
            ? { audience: audience as Prisma.InputJsonValue }
            : {}),
        },
        include: { branches: { include: { branch: { select: { id: true, name: true, code: true } } } } },
      });
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'CAMPAIGN_UPDATED',
      resourceType: 'Campaign',
      resourceId: id,
      requestId: ctx.requestId,
    });
    return campaign;
  }

  async archive(user: AuthenticatedUser, id: string, ctx: RequestContext) {
    await this.getById(user, id);
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'CAMPAIGN_ARCHIVED',
      resourceType: 'Campaign',
      resourceId: id,
      requestId: ctx.requestId,
    });
    return campaign;
  }
}
