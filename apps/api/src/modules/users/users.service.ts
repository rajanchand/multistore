import { Injectable } from '@nestjs/common';
import { hashPassword } from '@repo/auth';
import type { Permission } from '@repo/types';
import type { CreateUserInput, UpdateUserInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../sessions/session.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  async list(user: AuthenticatedUser, params: { page: number; pageSize: number; search?: string }) {
    const where = {
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: 'insensitive' as const } },
              { firstName: { contains: params.search, mode: 'insensitive' as const } },
              { lastName: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      // Branch-scoped admins only see users of their own branches.
      ...(user.isGlobal
        ? {}
        : { branches: { some: { branchId: { in: [...user.branchIds] } } } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isGlobal: true,
          mfaEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          roles: { include: { role: { select: { id: true, name: true } } } },
          branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: params.page, pageSize: params.pageSize, totalPages: Math.ceil(total / params.pageSize) };
  }

  /**
   * Create a user. Anti-privilege-escalation:
   *  - the actor cannot grant roles containing permissions they lack,
   *  - branch-scoped actors cannot create global users or assign foreign branches.
   */
  async create(actor: AuthenticatedUser, input: CreateUserInput, ctx: RequestContext) {
    await this.assertGrantable(actor, input.roleIds);
    if (input.isGlobal && !actor.isGlobal) {
      throw Errors.forbidden('Only HQ users can create global-scope users.');
    }
    if (input.branchIds.length > 0) this.branchAccess.assertCanAccessAll(actor, input.branchIds);

    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw Errors.conflict('EMAIL_IN_USE', 'A user with this email already exists.');

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        isGlobal: input.isGlobal,
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
        branches: { create: input.branchIds.map((branchId) => ({ branchId })) },
      },
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'USER_CREATED',
      resourceType: 'User',
      resourceId: user.id,
      newValue: { email: input.email, roleIds: input.roleIds, isGlobal: input.isGlobal, branchIds: input.branchIds },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return this.publicUser(user.id);
  }

  async update(actor: AuthenticatedUser, userId: string, input: UpdateUserInput, ctx: RequestContext) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { roles: true, branches: true },
    });
    if (!target) throw Errors.notFound('User');

    if (input.roleIds) await this.assertGrantable(actor, input.roleIds);
    if (input.isGlobal === true && !actor.isGlobal) {
      throw Errors.forbidden('Only HQ users can grant global scope.');
    }
    if (input.branchIds) this.branchAccess.assertCanAccessAll(actor, input.branchIds);

    // Guard the last active SUPER_ADMIN from deactivation/role removal.
    if (input.isActive === false || input.roleIds) {
      await this.assertNotLastSuperAdmin(userId, input);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.firstName ? { firstName: input.firstName } : {}),
          ...(input.lastName ? { lastName: input.lastName } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.isGlobal !== undefined ? { isGlobal: input.isGlobal } : {}),
        },
      });
      if (input.roleIds) {
        await tx.userRole.deleteMany({ where: { userId } });
        await tx.userRole.createMany({ data: input.roleIds.map((roleId) => ({ userId, roleId })) });
      }
      if (input.branchIds) {
        await tx.userBranch.deleteMany({ where: { userId } });
        await tx.userBranch.createMany({
          data: input.branchIds.map((branchId) => ({ userId, branchId })),
        });
      }
    });

    if (input.isActive === false) {
      await this.sessions.revokeAll({ userId });
    }

    await this.audit.log({
      actorUserId: actor.id,
      action: input.roleIds ? 'USER_ROLE_CHANGED' : 'USER_UPDATED',
      resourceType: 'User',
      resourceId: userId,
      oldValue: {
        roleIds: target.roles.map((r) => r.roleId),
        branchIds: target.branches.map((b) => b.branchId),
        isActive: target.isActive,
      },
      newValue: input,
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return this.publicUser(userId);
  }

  async revokeSessions(actor: AuthenticatedUser, userId: string, ctx: RequestContext) {
    const target = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!target) throw Errors.notFound('User');
    const count = await this.sessions.revokeAll({ userId });
    await this.audit.log({
      actorUserId: actor.id,
      action: 'USER_SESSIONS_REVOKED',
      resourceType: 'User',
      resourceId: userId,
      metadata: { revoked: count },
      requestId: ctx.requestId,
    });
    return { revoked: count };
  }

  private async publicUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isGlobal: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { include: { role: { select: { id: true, name: true } } } },
        branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
      },
    });
  }

  /** The actor may only grant roles whose permissions are a subset of their own. */
  private async assertGrantable(actor: AuthenticatedUser, roleIds: string[]): Promise<void> {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      include: { permissions: { include: { permission: true } } },
    });
    if (roles.length !== roleIds.length) throw Errors.notFound('Role');
    for (const role of roles) {
      for (const rp of role.permissions) {
        if (!actor.permissions.has(rp.permission.key as Permission)) {
          throw Errors.forbidden(
            `You cannot grant role ${role.name}: it includes "${rp.permission.key}" which you do not hold.`,
          );
        }
      }
    }
  }

  /** Prevent removing the platform's last active super admin access path. */
  private async assertNotLastSuperAdmin(userId: string, input: UpdateUserInput): Promise<void> {
    const superAdminRole = await this.prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    if (!superAdminRole) return;
    const targetHasIt = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: superAdminRole.id } },
    });
    if (!targetHasIt) return;
    const keepsRole = input.roleIds ? input.roleIds.includes(superAdminRole.id) : true;
    const staysActive = input.isActive !== false;
    if (keepsRole && staysActive) return;

    const otherActiveSuperAdmins = await this.prisma.user.count({
      where: {
        id: { not: userId },
        isActive: true,
        deletedAt: null,
        roles: { some: { roleId: superAdminRole.id } },
      },
    });
    if (otherActiveSuperAdmins === 0) {
      throw Errors.conflict(
        'LAST_SUPER_ADMIN',
        'This is the last active super admin. Create another super admin before removing this access.',
      );
    }
  }
}
