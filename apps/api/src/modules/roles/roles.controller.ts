import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS, type Permission } from '@repo/types';
import {
  createRoleSchema,
  updateRoleSchema,
  type CreateRoleInput,
  type UpdateRoleInput,
} from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser } from '../../common/auth-context';

@ApiTags('roles')
@Controller('roles')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequirePermissions('role.manage')
export class RolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('permissions')
  permissionCatalogue() {
    return Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description }));
  }

  @Get()
  async list() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRoleSchema)) body: CreateRoleInput,
    @Req() req: Request,
  ) {
    // The actor can only include permissions they themselves hold.
    this.assertGrantable(user, body.permissions as Permission[]);
    const existing = await this.prisma.role.findUnique({ where: { name: body.name } });
    if (existing) throw Errors.conflict('ROLE_EXISTS', 'A role with this name already exists.');

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: body.permissions } },
    });
    const role = await this.prisma.role.create({
      data: {
        name: body.name,
        description: body.description,
        isSystem: false,
        permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
      },
      include: { permissions: { include: { permission: true } } },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'ROLE_CREATED',
      resourceType: 'Role',
      resourceId: role.id,
      newValue: { name: body.name, permissions: body.permissions },
      requestId: (req as Request & { requestId?: string }).requestId,
    });
    return role;
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) body: UpdateRoleInput,
    @Req() req: Request,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw Errors.notFound('Role');
    if (role.isSystem) {
      throw Errors.conflict('SYSTEM_ROLE', 'System roles cannot be modified. Create a custom role instead.');
    }
    if (body.permissions) this.assertGrantable(user, body.permissions as Permission[]);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (body.permissions) {
        const permissions = await tx.permission.findMany({ where: { key: { in: body.permissions } } });
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
        });
      }
      return tx.role.update({
        where: { id },
        data: { ...(body.description !== undefined ? { description: body.description } : {}) },
        include: { permissions: { include: { permission: true } } },
      });
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'ROLE_UPDATED',
      resourceType: 'Role',
      resourceId: id,
      oldValue: { permissions: role.permissions.map((p) => p.permission.key) },
      newValue: body,
      requestId: (req as Request & { requestId?: string }).requestId,
    });
    return updated;
  }

  private assertGrantable(user: AuthenticatedUser, permissions: Permission[]): void {
    const missing = permissions.filter((p) => !user.permissions.has(p));
    if (missing.length > 0) {
      throw Errors.forbidden(`You cannot grant permissions you do not hold: ${missing.join(', ')}`);
    }
  }
}
