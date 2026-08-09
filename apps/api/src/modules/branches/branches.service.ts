import { Injectable } from '@nestjs/common';
import type { Prisma } from '@repo/database';
import type { CreateBranchInput, UpdateBranchInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  async list(user: AuthenticatedUser, includeInactive = false) {
    return this.prisma.branch.findMany({
      where: {
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
        ...(user.isGlobal ? {} : { id: { in: [...user.branchIds] } }),
      },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getById(user: AuthenticatedUser, branchId: string) {
    this.branchAccess.assertCanAccess(user, branchId);
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, deletedAt: null },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        users: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
            },
          },
        },
      },
    });
    if (!branch) throw Errors.notFound('Branch');
    return branch;
  }

  async create(user: AuthenticatedUser, input: CreateBranchInput, ctx: RequestContext) {
    const conflict = await this.prisma.branch.findFirst({
      where: { OR: [{ code: input.code }, { slug: input.slug }] },
    });
    if (conflict) {
      throw Errors.conflict('BRANCH_EXISTS', 'A branch with this code or slug already exists.');
    }
    const branch = await this.prisma.branch.create({
      data: {
        ...input,
        openingHours: (input.openingHours ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.log({
      actorUserId: user.id,
      branchId: branch.id,
      action: 'BRANCH_CREATED',
      resourceType: 'Branch',
      resourceId: branch.id,
      newValue: { name: branch.name, code: branch.code },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return branch;
  }

  async update(user: AuthenticatedUser, branchId: string, input: UpdateBranchInput, ctx: RequestContext) {
    this.branchAccess.assertCanAccess(user, branchId);
    const existing = await this.prisma.branch.findFirst({ where: { id: branchId, deletedAt: null } });
    if (!existing) throw Errors.notFound('Branch');

    const branch = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...input,
        openingHours: (input.openingHours ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit.log({
      actorUserId: user.id,
      branchId,
      action: 'BRANCH_UPDATED',
      resourceType: 'Branch',
      resourceId: branchId,
      oldValue: diffOf(existing, input),
      newValue: input,
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return branch;
  }

  async setActive(user: AuthenticatedUser, branchId: string, isActive: boolean, ctx: RequestContext) {
    this.branchAccess.assertCanAccess(user, branchId);
    const branch = await this.prisma.branch.update({ where: { id: branchId }, data: { isActive } });
    await this.audit.log({
      actorUserId: user.id,
      branchId,
      action: isActive ? 'BRANCH_ENABLED' : 'BRANCH_DISABLED',
      resourceType: 'Branch',
      resourceId: branchId,
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return branch;
  }

  /** Soft delete. Order/audit history remains intact. */
  async archive(user: AuthenticatedUser, branchId: string, ctx: RequestContext) {
    this.branchAccess.assertCanAccess(user, branchId);
    const branch = await this.prisma.branch.update({
      where: { id: branchId },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.log({
      actorUserId: user.id,
      branchId,
      action: 'BRANCH_ARCHIVED',
      resourceType: 'Branch',
      resourceId: branchId,
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return branch;
  }
}

/** Extract only the fields being changed, for a meaningful audit before-image. */
function diffOf(existing: Record<string, unknown>, input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (key in existing) out[key] = existing[key];
  }
  return out;
}
