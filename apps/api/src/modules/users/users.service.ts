import { Injectable } from '@nestjs/common';
import { hashPassword } from '@repo/auth';
import type { Permission } from '@repo/types';
import type {
  CreateUserInput,
  ResetUserPasswordInput,
  UpdateUserInput,
} from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../sessions/session.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

const userSelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  isActive: true,
  isGlobal: true,
  mfaEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: { include: { role: { select: { id: true, name: true, description: true } } } },
  branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
} as const;

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
              { username: { contains: params.search, mode: 'insensitive' as const } },
              { firstName: { contains: params.search, mode: 'insensitive' as const } },
              { lastName: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(user.isGlobal
        ? {}
        : { branches: { some: { branchId: { in: [...user.branchIds] } } } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  async get(actor: AuthenticatedUser, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: userSelect,
    });
    if (!user) throw Errors.notFound('User');
    this.assertCanView(actor, user);
    return user;
  }

  async assignableRoles(actor: AuthenticatedUser) {
    const roles = await this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        _count: { select: { users: true } },
        permissions: { include: { permission: { select: { key: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    // Actors may only assign roles whose permissions are a subset of their own.
    return roles
      .filter((role) =>
        role.permissions.every((rp) => actor.permissions.has(rp.permission.key as Permission)),
      )
      .map(({ permissions: _permissions, ...role }) => role);
  }

  async create(actor: AuthenticatedUser, input: CreateUserInput, ctx: RequestContext) {
    await this.assertGrantable(actor, input.roleIds);
    if (input.isGlobal && !actor.isGlobal) {
      throw Errors.forbidden('Only HQ users can create global-scope users.');
    }
    if (input.branchIds.length > 0) this.branchAccess.assertCanAccessAll(actor, input.branchIds);

    const emailTaken = await this.prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
    });
    if (emailTaken) throw Errors.conflict('EMAIL_IN_USE', 'A user with this email already exists.');

    const usernameTaken = await this.prisma.user.findFirst({
      where: { username: input.username, deletedAt: null },
    });
    if (usernameTaken) {
      throw Errors.conflict('USERNAME_IN_USE', 'A user with this username already exists.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        isGlobal: input.isGlobal,
        isActive: input.isActive,
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
        branches: { create: input.branchIds.map((branchId) => ({ branchId })) },
      },
    });

    await this.audit.log({
      actorUserId: actor.id,
      action: 'USER_CREATED',
      resourceType: 'User',
      resourceId: user.id,
      newValue: {
        email: input.email,
        username: input.username,
        roleIds: input.roleIds,
        isGlobal: input.isGlobal,
        branchIds: input.branchIds,
        isActive: input.isActive,
      },
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
    this.assertCanView(actor, {
      isGlobal: target.isGlobal,
      branches: target.branches.map((b) => ({ branch: { id: b.branchId } })),
    });

    if (input.roleIds) await this.assertGrantable(actor, input.roleIds);
    if (input.isGlobal === true && !actor.isGlobal) {
      throw Errors.forbidden('Only HQ users can grant global scope.');
    }
    // Branch admins may only assign branches they can access; foreign memberships are preserved.
    let nextBranchIds = input.branchIds;
    if (input.branchIds) {
      this.branchAccess.assertCanAccessAll(actor, input.branchIds);
      if (!actor.isGlobal) {
        const preserved = target.branches
          .map((b) => b.branchId)
          .filter((id) => !actor.branchIds.has(id));
        nextBranchIds = [...new Set([...preserved, ...input.branchIds])];
      }
    }

    if (input.email && input.email !== target.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: { email: input.email, deletedAt: null, NOT: { id: userId } },
      });
      if (emailTaken) throw Errors.conflict('EMAIL_IN_USE', 'A user with this email already exists.');
    }
    if (input.username && input.username !== target.username) {
      const usernameTaken = await this.prisma.user.findFirst({
        where: { username: input.username, deletedAt: null, NOT: { id: userId } },
      });
      if (usernameTaken) {
        throw Errors.conflict('USERNAME_IN_USE', 'A user with this username already exists.');
      }
    }

    if (input.isActive === false || input.roleIds) {
      await this.assertNotLastSuperAdmin(userId, input);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.firstName ? { firstName: input.firstName } : {}),
          ...(input.lastName ? { lastName: input.lastName } : {}),
          ...(input.username ? { username: input.username } : {}),
          ...(input.email ? { email: input.email } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.isGlobal !== undefined ? { isGlobal: input.isGlobal } : {}),
        },
      });
      if (input.roleIds) {
        await tx.userRole.deleteMany({ where: { userId } });
        await tx.userRole.createMany({ data: input.roleIds.map((roleId) => ({ userId, roleId })) });
      }
      if (nextBranchIds) {
        await tx.userBranch.deleteMany({ where: { userId } });
        await tx.userBranch.createMany({
          data: nextBranchIds.map((branchId) => ({ userId, branchId })),
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

  async resetPassword(
    actor: AuthenticatedUser,
    userId: string,
    input: ResetUserPasswordInput,
    ctx: RequestContext,
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { branches: true },
    });
    if (!target) throw Errors.notFound('User');
    this.assertCanView(actor, {
      isGlobal: target.isGlobal,
      branches: target.branches.map((b) => ({ branch: { id: b.branchId } })),
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(input.password),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await this.sessions.revokeAll({ userId });
    await this.audit.log({
      actorUserId: actor.id,
      action: 'USER_PASSWORD_RESET',
      resourceType: 'User',
      resourceId: userId,
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return { ok: true };
  }

  async remove(actor: AuthenticatedUser, userId: string, ctx: RequestContext) {
    if (actor.id === userId) {
      throw Errors.conflict('CANNOT_DELETE_SELF', 'You cannot delete your own account.');
    }
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { branches: true, roles: true },
    });
    if (!target) throw Errors.notFound('User');
    this.assertCanView(actor, {
      isGlobal: target.isGlobal,
      branches: target.branches.map((b) => ({ branch: { id: b.branchId } })),
    });

    await this.assertNotLastSuperAdmin(userId, { isActive: false, roleIds: [] });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: `deleted+${userId.slice(0, 8)}@deleted.local`,
        username: `deleted_${userId.slice(0, 8)}`,
      },
    });
    await this.sessions.revokeAll({ userId });
    await this.audit.log({
      actorUserId: actor.id,
      action: 'USER_DELETED',
      resourceType: 'User',
      resourceId: userId,
      oldValue: { email: target.email, username: target.username },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return { ok: true };
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

  private assertCanView(
    actor: AuthenticatedUser,
    target: { isGlobal: boolean; branches: Array<{ branch: { id: string } }> },
  ) {
    if (actor.isGlobal) return;
    if (target.isGlobal) throw Errors.forbidden('Branch admins cannot manage HQ users.');
    const ids = new Set(target.branches.map((b) => b.branch.id));
    const overlap = [...actor.branchIds].some((id) => ids.has(id));
    if (!overlap) throw Errors.forbidden('You do not have access to this user.');
  }

  private async publicUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
  }

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
