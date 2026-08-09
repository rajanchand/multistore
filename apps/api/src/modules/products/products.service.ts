import { Injectable } from '@nestjs/common';
import type { Prisma } from '@repo/database';
import type { CreateProductInput, UpdateProductInput, UpsertBranchProductInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { Errors } from '../../common/errors';
import type { AuthenticatedUser, RequestContext } from '../../common/auth-context';

export interface ProductListQuery {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  branchId?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  async list(user: AuthenticatedUser, query: ProductListQuery) {
    if (query.branchId) this.branchAccess.assertCanAccess(user, query.branchId);

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
              { barcode: { contains: query.search, mode: 'insensitive' } },
              { brand: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
      ...(query.branchId ? { branchProducts: { some: { branchId: query.branchId } } } : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sortBy === 'name'
        ? { name: query.sortOrder ?? 'asc' }
        : query.sortBy === 'sku'
          ? { sku: query.sortOrder ?? 'asc' }
          : { updatedAt: query.sortOrder ?? 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
          variants: {
            where: { deletedAt: null },
            select: { id: true, sku: true, name: true, defaultPrice: true, isDefault: true },
          },
          branchProducts: {
            select: { branchId: true, sellingPrice: true, salePrice: true, isVisible: true },
          },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    // Aggregate stock per product across authorised branches only.
    const productIds = items.map((p) => p.id);
    const stock = await this.prisma.inventory.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, ...this.branchAccess.branchFilter(user) },
      _sum: { available: true },
    });
    const stockByProduct = new Map(stock.map((s) => [s.productId, s._sum.available ?? 0]));

    return {
      items: items.map((p) => ({
        ...p,
        totalStock: stockByProduct.get(p.id) ?? 0,
        branchCount: new Set(p.branchProducts.map((bp) => bp.branchId)).size,
        priceRange: priceRangeOf(p.branchProducts),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getById(user: AuthenticatedUser, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: {
        categories: { include: { category: true } },
        variants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        branchProducts: {
          where: user.isGlobal ? {} : { branchId: { in: [...user.branchIds] } },
          include: { branch: { select: { id: true, name: true, code: true } } },
        },
      },
    });
    if (!product) throw Errors.notFound('Product');

    const inventory = await this.prisma.inventory.findMany({
      where: { productId, ...this.branchAccess.branchFilter(user) },
      select: { branchId: true, variantId: true, available: true, reserved: true, lowStockThreshold: true },
    });
    return { ...product, inventory };
  }

  async create(user: AuthenticatedUser, input: CreateProductInput, ctx: RequestContext) {
    const conflict = await this.prisma.product.findFirst({
      where: { OR: [{ sku: input.sku }, { slug: input.slug }] },
    });
    if (conflict) throw Errors.conflict('PRODUCT_EXISTS', 'A product with this SKU or slug already exists.');

    const { categoryIds, variants, salePrice, branchIds, ...productData } = input;
    if (branchIds.length > 0) this.branchAccess.assertCanAccessAll(user, branchIds);

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...productData,
          images: productData.images as Prisma.InputJsonValue,
          createdById: user.id,
          categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        },
      });
      const variantSpecs =
        variants.length > 0
          ? variants
          : [
              {
                sku: input.sku,
                name: input.name,
                attributes: {},
                defaultPrice: 0,
                images: [],
                barcode: undefined,
                costPrice: undefined,
                weightGrams: undefined,
              },
            ];
      for (const [i, v] of variantSpecs.entries()) {
        await tx.productVariant.create({
          data: {
            productId: created.id,
            sku: v.sku,
            barcode: v.barcode,
            name: v.name,
            attributes: v.attributes as Prisma.InputJsonValue,
            costPrice: v.costPrice,
            defaultPrice: v.defaultPrice,
            weightGrams: v.weightGrams,
            images: (v.images ?? []) as Prisma.InputJsonValue,
            isDefault: i === 0,
          },
        });
      }
      return created;
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'PRODUCT_CREATED',
      resourceType: 'Product',
      resourceId: product.id,
      newValue: { name: product.name, sku: product.sku, branchIds, salePrice: salePrice ?? null },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });

    // Attach to selected stores: BranchProduct + inventory per variant, using create prices.
    if (branchIds.length > 0) {
      const createdVariants = await this.prisma.productVariant.findMany({
        where: { productId: product.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      for (const branchId of branchIds) {
        for (const variant of createdVariants) {
          await this.upsertBranchProduct(
            user,
            {
              branchId,
              productId: product.id,
              variantId: variant.id,
              sellingPrice: variant.defaultPrice,
              salePrice: salePrice ?? null,
              isVisible: true,
              isAvailable: true,
              deliveryEnabled: true,
              clickCollectEnabled: true,
              minimumOrderQuantity: 1,
              maximumOrderQuantity: null,
            },
            ctx,
          );
        }
      }
    }

    return this.getById(user, product.id);
  }

  async update(user: AuthenticatedUser, productId: string, input: UpdateProductInput, ctx: RequestContext) {
    const existing = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!existing) throw Errors.notFound('Product');

    const { categoryIds, ...productData } = input;
    const product = await this.prisma.$transaction(async (tx) => {
      if (categoryIds) {
        await tx.productCategory.deleteMany({ where: { productId } });
        await tx.productCategory.createMany({
          data: categoryIds.map((categoryId) => ({ productId, categoryId })),
        });
      }
      return tx.product.update({
        where: { id: productId },
        data: {
          ...productData,
          images: productData.images as Prisma.InputJsonValue | undefined,
        },
      });
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'PRODUCT_UPDATED',
      resourceType: 'Product',
      resourceId: productId,
      oldValue: pickKeys(existing, Object.keys(input)),
      newValue: input,
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return product;
  }

  async setStatus(user: AuthenticatedUser, productId: string, status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED', ctx: RequestContext) {
    const existing = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!existing) throw Errors.notFound('Product');
    const product = await this.prisma.product.update({
      where: { id: productId },
      data: { status, ...(status === 'ARCHIVED' ? { deletedAt: new Date() } : {}) },
    });
    await this.audit.log({
      actorUserId: user.id,
      action: status === 'ARCHIVED' ? 'PRODUCT_ARCHIVED' : status === 'ACTIVE' ? 'PRODUCT_PUBLISHED' : 'PRODUCT_UNPUBLISHED',
      resourceType: 'Product',
      resourceId: productId,
      oldValue: { status: existing.status },
      newValue: { status },
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });
    return product;
  }

  /** Branch product matrix for one product: per-branch price/stock/visibility. */
  async branchMatrix(user: AuthenticatedUser, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: { variants: { where: { deletedAt: null } } },
    });
    if (!product) throw Errors.notFound('Product');

    const branches = await this.prisma.branch.findMany({
      where: {
        deletedAt: null,
        code: { not: 'HQ' },
        ...(user.isGlobal ? {} : { id: { in: [...user.branchIds] } }),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });

    const [branchProducts, inventory] = await Promise.all([
      this.prisma.branchProduct.findMany({ where: { productId } }),
      this.prisma.inventory.findMany({ where: { productId } }),
    ]);
    const bpKey = (b: string, v: string) => `${b}:${v}`;
    const bpMap = new Map(branchProducts.map((bp) => [bpKey(bp.branchId, bp.variantId), bp]));
    const invMap = new Map(inventory.map((inv) => [bpKey(inv.branchId, inv.variantId), inv]));

    return {
      product: { id: product.id, name: product.name, sku: product.sku },
      variants: product.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, defaultPrice: v.defaultPrice })),
      rows: branches.map((branch) => ({
        branch,
        cells: product.variants.map((v) => {
          const bp = bpMap.get(bpKey(branch.id, v.id));
          const inv = invMap.get(bpKey(branch.id, v.id));
          return {
            variantId: v.id,
            configured: Boolean(bp),
            sellingPrice: bp?.sellingPrice ?? null,
            salePrice: bp?.salePrice ?? null,
            isVisible: bp?.isVisible ?? false,
            isAvailable: bp?.isAvailable ?? false,
            available: inv?.available ?? 0,
            reserved: inv?.reserved ?? 0,
          };
        }),
      })),
    };
  }

  /** Create or update a branch's commercial config for a variant. Audited. */
  async upsertBranchProduct(user: AuthenticatedUser, input: UpsertBranchProductInput, ctx: RequestContext) {
    this.branchAccess.assertCanAccess(user, input.branchId);

    const variantId = input.variantId ?? null;
    let resolvedVariantId = variantId;
    if (!resolvedVariantId) {
      const defaultVariant = await this.prisma.productVariant.findFirst({
        where: { productId: input.productId, isDefault: true, deletedAt: null },
      });
      if (!defaultVariant) throw Errors.notFound('Default variant');
      resolvedVariantId = defaultVariant.id;
    } else {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: resolvedVariantId, productId: input.productId, deletedAt: null },
      });
      if (!variant) throw Errors.notFound('Variant');
    }

    const existing = await this.prisma.branchProduct.findUnique({
      where: { branchId_variantId: { branchId: input.branchId, variantId: resolvedVariantId } },
    });

    const data = {
      sellingPrice: input.sellingPrice,
      salePrice: input.salePrice ?? null,
      isVisible: input.isVisible,
      isAvailable: input.isAvailable,
      deliveryEnabled: input.deliveryEnabled,
      clickCollectEnabled: input.clickCollectEnabled,
      minimumOrderQuantity: input.minimumOrderQuantity,
      maximumOrderQuantity: input.maximumOrderQuantity ?? null,
    };

    const result = existing
      ? await this.prisma.branchProduct.update({ where: { id: existing.id }, data })
      : await this.prisma.branchProduct.create({
          data: { ...data, branchId: input.branchId, productId: input.productId, variantId: resolvedVariantId },
        });

    // Ensure an inventory row exists so stock operations have a target.
    await this.prisma.inventory.upsert({
      where: { branchId_variantId: { branchId: input.branchId, variantId: resolvedVariantId } },
      create: { branchId: input.branchId, productId: input.productId, variantId: resolvedVariantId },
      update: {},
    });

    await this.audit.log({
      actorUserId: user.id,
      branchId: input.branchId,
      action: existing
        ? existing.sellingPrice !== input.sellingPrice || existing.salePrice !== (input.salePrice ?? null)
          ? 'PRODUCT_PRICE_UPDATED'
          : 'BRANCH_PRODUCT_UPDATED'
        : 'BRANCH_PRODUCT_CREATED',
      resourceType: 'BranchProduct',
      resourceId: result.id,
      oldValue: existing
        ? { sellingPrice: existing.sellingPrice, salePrice: existing.salePrice, isVisible: existing.isVisible, isAvailable: existing.isAvailable }
        : undefined,
      newValue: data,
      requestId: ctx.requestId,
      ipAddress: ctx.ip,
    });

    return result;
  }
}

function priceRangeOf(branchProducts: { sellingPrice: number; salePrice: number | null }[]): {
  min: number | null;
  max: number | null;
} {
  if (branchProducts.length === 0) return { min: null, max: null };
  const prices = branchProducts.map((bp) => bp.salePrice ?? bp.sellingPrice);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function pickKeys(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}
