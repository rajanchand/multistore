import { Injectable } from '@nestjs/common';
import type { CreateBrandInput, CreateCategoryInput, UpdateBrandInput, UpdateCategoryInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

@Injectable()
export class CatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  // --- Categories ---

  async listCategories(user: AuthenticatedUser, includeHidden = true) {
    return this.prisma.category.findMany({
      where: {
        deletedAt: null,
        ...(includeHidden ? {} : { isVisible: true }),
        ...this.branchAccess.allBranchesOrAssignedFilter(user),
      },
      include: {
        _count: { select: { products: true } },
        branches: {
          where: user.isGlobal ? {} : { branchId: { in: [...user.branchIds] } },
          include: { branch: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getCategory(user: AuthenticatedUser, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { products: true } },
        branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
      },
    });
    if (!category) throw Errors.notFound('Category');
    this.assertCanViewCatalogueEntity(user, category);
    return {
      ...category,
      branches: user.isGlobal
        ? category.branches
        : category.branches.filter((b) => user.branchIds.has(b.branchId)),
    };
  }

  async createCategory(user: AuthenticatedUser, input: CreateCategoryInput, ctx: RequestContext) {
    const { branchIds, ...data } = input;
    if (data.allBranches && !user.isGlobal) {
      throw Errors.forbidden('Only HQ users can create categories for all branches.');
    }
    if (!data.allBranches && branchIds.length > 0) {
      this.branchAccess.assertCanAccessAll(user, branchIds);
    }
    if (!data.allBranches && branchIds.length === 0 && !user.isGlobal) {
      throw Errors.badRequest('BRANCHES_REQUIRED', 'Select at least one branch for this category.');
    }
    const conflict = await this.prisma.category.findUnique({ where: { slug: data.slug } });
    if (conflict) throw Errors.conflict('CATEGORY_EXISTS', 'A category with this slug already exists.');

    const category = await this.prisma.category.create({
      data: {
        ...data,
        image: data.image ?? null,
        branches:
          data.allBranches || branchIds.length === 0
            ? undefined
            : { create: branchIds.map((branchId) => ({ branchId })) },
      },
      include: {
        branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
      },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'CATEGORY_CREATED',
      resourceType: 'Category',
      resourceId: category.id,
      newValue: { name: category.name, slug: category.slug, branchIds },
      requestId: ctx.requestId,
    });
    return category;
  }

  async updateCategory(
    user: AuthenticatedUser,
    id: string,
    input: UpdateCategoryInput,
    ctx: RequestContext,
  ) {
    const existing = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: { branches: true },
    });
    if (!existing) throw Errors.notFound('Category');
    this.branchAccess.assertCanManageBranchScoped(user, existing);

    const { branchIds, ...data } = input;
    if (data.allBranches === true && !user.isGlobal) {
      throw Errors.forbidden('Only HQ users can mark categories as all-branches.');
    }
    if (branchIds) this.branchAccess.assertCanAccessAll(user, branchIds);

    const category = await this.prisma.$transaction(async (tx) => {
      if (branchIds) {
        await tx.categoryBranch.deleteMany({ where: { categoryId: id } });
        const allBranches = data.allBranches ?? existing.allBranches;
        if (!allBranches && branchIds.length > 0) {
          await tx.categoryBranch.createMany({
            data: branchIds.map((branchId) => ({ categoryId: id, branchId })),
          });
        }
      }
      return tx.category.update({
        where: { id },
        data: {
          ...data,
          ...(data.image !== undefined ? { image: data.image } : {}),
        },
        include: {
          branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
        },
      });
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'CATEGORY_UPDATED',
      resourceType: 'Category',
      resourceId: id,
      newValue: input,
      requestId: ctx.requestId,
    });
    return category;
  }

  async setCategoryVisibility(user: AuthenticatedUser, id: string, isVisible: boolean, ctx: RequestContext) {
    const existing = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: { branches: true },
    });
    if (!existing) throw Errors.notFound('Category');
    this.branchAccess.assertCanManageBranchScoped(user, existing);
    const category = await this.prisma.category.update({ where: { id }, data: { isVisible } });
    await this.audit.log({
      actorUserId: user.id,
      action: isVisible ? 'CATEGORY_SHOWN' : 'CATEGORY_HIDDEN',
      resourceType: 'Category',
      resourceId: id,
      requestId: ctx.requestId,
    });
    return category;
  }

  async archiveCategory(user: AuthenticatedUser, id: string, ctx: RequestContext) {
    const existing = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: { branches: true },
    });
    if (!existing) throw Errors.notFound('Category');
    this.branchAccess.assertCanManageBranchScoped(user, existing);
    const category = await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), isVisible: false },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'CATEGORY_ARCHIVED',
      resourceType: 'Category',
      resourceId: id,
      requestId: ctx.requestId,
    });
    return category;
  }

  // --- Brands ---

  async listBrands(user: AuthenticatedUser, includeHidden = true) {
    return this.prisma.brand.findMany({
      where: {
        deletedAt: null,
        ...(includeHidden ? {} : { isVisible: true }),
        ...this.branchAccess.allBranchesOrAssignedFilter(user),
      },
      include: {
        _count: { select: { products: true } },
        branches: {
          where: user.isGlobal ? {} : { branchId: { in: [...user.branchIds] } },
          include: { branch: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getBrand(user: AuthenticatedUser, id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { products: true } },
        branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
      },
    });
    if (!brand) throw Errors.notFound('Brand');
    this.assertCanViewCatalogueEntity(user, brand);
    return {
      ...brand,
      branches: user.isGlobal
        ? brand.branches
        : brand.branches.filter((b) => user.branchIds.has(b.branchId)),
    };
  }

  async createBrand(user: AuthenticatedUser, input: CreateBrandInput, ctx: RequestContext) {
    const { branchIds, ...data } = input;
    if (data.allBranches && !user.isGlobal) {
      throw Errors.forbidden('Only HQ users can create brands for all branches.');
    }
    if (!data.allBranches && branchIds.length > 0) {
      this.branchAccess.assertCanAccessAll(user, branchIds);
    }
    if (!data.allBranches && branchIds.length === 0 && !user.isGlobal) {
      throw Errors.badRequest('BRANCHES_REQUIRED', 'Select at least one branch for this brand.');
    }
    const conflict = await this.prisma.brand.findUnique({ where: { slug: data.slug } });
    if (conflict) throw Errors.conflict('BRAND_EXISTS', 'A brand with this slug already exists.');

    const brand = await this.prisma.brand.create({
      data: {
        ...data,
        image: data.image ?? null,
        branches:
          data.allBranches || branchIds.length === 0
            ? undefined
            : { create: branchIds.map((branchId) => ({ branchId })) },
      },
      include: {
        branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
      },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'BRAND_CREATED',
      resourceType: 'Brand',
      resourceId: brand.id,
      newValue: { name: brand.name, slug: brand.slug, branchIds },
      requestId: ctx.requestId,
    });
    return brand;
  }

  async updateBrand(user: AuthenticatedUser, id: string, input: UpdateBrandInput, ctx: RequestContext) {
    const existing = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      include: { branches: true },
    });
    if (!existing) throw Errors.notFound('Brand');
    this.branchAccess.assertCanManageBranchScoped(user, existing);

    const { branchIds, ...data } = input;
    if (data.allBranches === true && !user.isGlobal) {
      throw Errors.forbidden('Only HQ users can mark brands as all-branches.');
    }
    if (branchIds) this.branchAccess.assertCanAccessAll(user, branchIds);

    const brand = await this.prisma.$transaction(async (tx) => {
      if (branchIds) {
        await tx.brandBranch.deleteMany({ where: { brandId: id } });
        const allBranches = data.allBranches ?? existing.allBranches;
        if (!allBranches && branchIds.length > 0) {
          await tx.brandBranch.createMany({
            data: branchIds.map((branchId) => ({ brandId: id, branchId })),
          });
        }
      }
      const updated = await tx.brand.update({
        where: { id },
        data: {
          ...data,
          ...(data.image !== undefined ? { image: data.image } : {}),
        },
        include: {
          branches: { include: { branch: { select: { id: true, name: true, code: true } } } },
        },
      });
      // Keep denormalised product.brand in sync when name changes.
      if (data.name && data.name !== existing.name) {
        await tx.product.updateMany({ where: { brandId: id }, data: { brand: data.name } });
      }
      return updated;
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'BRAND_UPDATED',
      resourceType: 'Brand',
      resourceId: id,
      newValue: input,
      requestId: ctx.requestId,
    });
    return brand;
  }

  async setBrandVisibility(user: AuthenticatedUser, id: string, isVisible: boolean, ctx: RequestContext) {
    const existing = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      include: { branches: true },
    });
    if (!existing) throw Errors.notFound('Brand');
    this.branchAccess.assertCanManageBranchScoped(user, existing);
    const brand = await this.prisma.brand.update({ where: { id }, data: { isVisible } });
    await this.audit.log({
      actorUserId: user.id,
      action: isVisible ? 'BRAND_SHOWN' : 'BRAND_HIDDEN',
      resourceType: 'Brand',
      resourceId: id,
      requestId: ctx.requestId,
    });
    return brand;
  }

  async archiveBrand(user: AuthenticatedUser, id: string, ctx: RequestContext) {
    const existing = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      include: { branches: true },
    });
    if (!existing) throw Errors.notFound('Brand');
    this.branchAccess.assertCanManageBranchScoped(user, existing);
    const brand = await this.prisma.brand.update({
      where: { id },
      data: { deletedAt: new Date(), isVisible: false },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: 'BRAND_ARCHIVED',
      resourceType: 'Brand',
      resourceId: id,
      requestId: ctx.requestId,
    });
    return brand;
  }

  private assertCanViewCatalogueEntity(
    user: AuthenticatedUser,
    entity: { allBranches: boolean; branches: Array<{ branchId: string }> },
  ): void {
    if (user.isGlobal || entity.allBranches) return;
    const overlap = entity.branches.some((b) => user.branchIds.has(b.branchId));
    if (!overlap) throw Errors.notFound('Record');
  }

  /** Ensure brands exist for free-text product.brand values (seed / migration helper). */
  async ensureBrandFromName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const slug = slugify(trimmed);
    return this.prisma.brand.upsert({
      where: { slug },
      create: { name: trimmed, slug, allBranches: true, isVisible: true },
      update: {},
    });
  }
}
