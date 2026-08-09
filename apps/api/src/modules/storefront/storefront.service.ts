import { Injectable } from '@nestjs/common';
import type { Prisma } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';
import { Errors } from '../../common/errors';
import {
  approximateLatLngFromPostcode,
  areaPrefix,
  compactUkPostcode,
  formatUkPostcode,
  haversineKm,
  outwardCode,
} from './uk-postcode';

interface CatalogueQuery {
  branchId: string;
  page: number;
  pageSize: number;
  categorySlug?: string;
  search?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: 'newest' | 'price_asc' | 'price_desc' | 'name';
}

@Injectable()
export class StorefrontService {
  constructor(private readonly prisma: PrismaService) {}

  async branches() {
    return this.prisma.branch.findMany({
      where: { isActive: true, deletedAt: null, code: { not: 'HQ' } },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        postcode: true,
        latitude: true,
        longitude: true,
        deliveryEnabled: true,
        clickCollectEnabled: true,
        deliveryFee: true,
        freeDeliveryThreshold: true,
        openingHours: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Nearest retail branches for a UK postcode using Haversine on seeded lat/lng,
   * with outward-code / city prefix fallback when geocode is unavailable.
   */
  async nearestBranches(postcodeInput: string) {
    const compact = compactUkPostcode(postcodeInput);
    if (compact.length < 2) {
      throw Errors.badRequest('INVALID_POSTCODE', 'Enter a valid UK postcode');
    }

    const formatted = formatUkPostcode(compact);
    const outward = outwardCode(compact);
    const prefix = areaPrefix(outward);
    const point = approximateLatLngFromPostcode(compact);

    const branches = await this.prisma.branch.findMany({
      where: { isActive: true, deletedAt: null, code: { not: 'HQ' } },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        postcode: true,
        addressLine1: true,
        latitude: true,
        longitude: true,
        deliveryEnabled: true,
        clickCollectEnabled: true,
      },
    });

    type Ranked = (typeof branches)[number] & {
      distanceKm: number | null;
      matchScore: number;
    };

    const ranked: Ranked[] = branches.map((b) => {
      const branchOutward = outwardCode(compactUkPostcode(b.postcode));
      const branchPrefix = areaPrefix(branchOutward);
      let matchScore = 0;
      if (branchOutward === outward) matchScore += 100;
      else if (branchOutward.startsWith(outward) || outward.startsWith(branchOutward)) matchScore += 60;
      else if (branchPrefix === prefix) matchScore += 40;
      else if (b.city.toLowerCase().includes(prefix.toLowerCase())) matchScore += 10;

      let distanceKm: number | null = null;
      if (
        point &&
        b.latitude != null &&
        b.longitude != null &&
        Number.isFinite(b.latitude) &&
        Number.isFinite(b.longitude)
      ) {
        distanceKm = Math.round(haversineKm(point.lat, point.lng, b.latitude, b.longitude) * 10) / 10;
        // Prefer closer branches within the same soft score band.
        matchScore += Math.max(0, 30 - Math.min(distanceKm, 30));
      }

      return { ...b, distanceKm, matchScore };
    });

    ranked.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name);
    });

    const top = ranked.slice(0, 3);
    const nearest = top[0];
    if (!nearest) {
      throw Errors.notFound('Branch');
    }

    return {
      postcode: formatted,
      outwardCode: outward,
      nearest: {
        id: nearest.id,
        name: nearest.name,
        slug: nearest.slug,
        city: nearest.city,
        postcode: nearest.postcode,
        addressLine1: nearest.addressLine1,
        deliveryEnabled: nearest.deliveryEnabled,
        clickCollectEnabled: nearest.clickCollectEnabled,
        distanceKm: nearest.distanceKm,
      },
      alternatives: top.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        city: b.city,
        postcode: b.postcode,
        addressLine1: b.addressLine1,
        deliveryEnabled: b.deliveryEnabled,
        clickCollectEnabled: b.clickCollectEnabled,
        distanceKm: b.distanceKm,
      })),
    };
  }

  /** Categories visible for a branch (global + branch-assigned, not hidden). */
  async categories(branchId?: string) {
    return this.prisma.category.findMany({
      where: {
        deletedAt: null,
        isVisible: true,
        ...(branchId
          ? {
              OR: [{ allBranches: true }, { branches: { some: { branchId } } }],
            }
          : {}),
      },
      select: { id: true, name: true, slug: true, image: true, parentId: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /** Brands visible for a branch. */
  async brands(branchId?: string) {
    return this.prisma.brand.findMany({
      where: {
        deletedAt: null,
        isVisible: true,
        ...(branchId
          ? {
              OR: [{ allBranches: true }, { branches: { some: { branchId } } }],
            }
          : {}),
      },
      select: { id: true, name: true, slug: true, image: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /** Branch catalogue: only visible/available branch products of active products. */
  async products(query: CatalogueQuery) {
    const where: Prisma.BranchProductWhereInput = {
      branchId: query.branchId,
      isVisible: true,
      variant: { isDefault: true, deletedAt: null },
      product: {
        status: 'ACTIVE',
        deletedAt: null,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { brand: { contains: query.search, mode: 'insensitive' } },
                { tags: { has: query.search.toLowerCase() } },
              ],
            }
          : {}),
        ...(query.brand ? { brand: { equals: query.brand, mode: 'insensitive' } } : {}),
        ...(query.categorySlug
          ? { categories: { some: { category: { slug: query.categorySlug } } } }
          : {}),
      },
      ...(query.minPrice != null ? { sellingPrice: { gte: query.minPrice } } : {}),
      ...(query.maxPrice != null ? { sellingPrice: { lte: query.maxPrice } } : {}),
    };

    const orderBy: Prisma.BranchProductOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { sellingPrice: 'asc' }
        : query.sort === 'price_desc'
          ? { sellingPrice: 'desc' }
          : query.sort === 'name'
            ? { product: { name: 'asc' } }
            : { product: { createdAt: 'desc' } };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.branchProduct.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              brand: true,
              shortDescription: true,
              images: true,
              tags: true,
            },
          },
          variant: { select: { id: true, sku: true } },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.branchProduct.count({ where }),
    ]);

    const variantIds = items.map((i) => i.variantId);
    const stock = await this.prisma.inventory.findMany({
      where: { branchId: query.branchId, variantId: { in: variantIds } },
      select: { variantId: true, available: true },
    });
    const stockByVariant = new Map(stock.map((s) => [s.variantId, s.available]));

    return {
      items: items.map((bp) => ({
        productId: bp.productId,
        variantId: bp.variantId,
        name: bp.product.name,
        slug: bp.product.slug,
        brand: bp.product.brand,
        shortDescription: bp.product.shortDescription,
        images: bp.product.images,
        price: bp.sellingPrice,
        salePrice: bp.salePrice,
        inStock: (stockByVariant.get(bp.variantId) ?? 0) > 0,
        stockLevel: levelOf(stockByVariant.get(bp.variantId) ?? 0),
        deliveryEnabled: bp.deliveryEnabled,
        clickCollectEnabled: bp.clickCollectEnabled,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  /** Full product detail with per-branch variant pricing and stock. */
  async productDetail(slug: string, branchId: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE', deletedAt: null },
      include: {
        categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
        variants: {
          where: { deletedAt: null, status: 'ACTIVE' },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!product) throw Errors.notFound('Product');

    const branchProducts = await this.prisma.branchProduct.findMany({
      where: { productId: product.id, branchId, isVisible: true },
    });
    if (branchProducts.length === 0) {
      throw Errors.notFound('Product'); // Not sold at this branch.
    }
    const bpByVariant = new Map(branchProducts.map((bp) => [bp.variantId, bp]));

    const inventory = await this.prisma.inventory.findMany({
      where: { productId: product.id, branchId },
      select: { variantId: true, available: true },
    });
    const stockByVariant = new Map(inventory.map((i) => [i.variantId, i.available]));

    const variants = product.variants
      .filter((v) => bpByVariant.has(v.id))
      .map((v) => {
        const bp = bpByVariant.get(v.id)!;
        const available = stockByVariant.get(v.id) ?? 0;
        return {
          id: v.id,
          sku: v.sku,
          name: v.name,
          attributes: v.attributes,
          images: v.images,
          isDefault: v.isDefault,
          price: bp.sellingPrice,
          salePrice: bp.salePrice,
          isAvailable: bp.isAvailable && available > 0,
          stockLevel: levelOf(available),
          deliveryEnabled: bp.deliveryEnabled,
          clickCollectEnabled: bp.clickCollectEnabled,
          minimumOrderQuantity: bp.minimumOrderQuantity,
          maximumOrderQuantity: bp.maximumOrderQuantity,
        };
      });

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      shortDescription: product.shortDescription,
      description: product.description,
      images: product.images,
      tags: product.tags,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      categories: product.categories.map((c) => c.category),
      variants,
    };
  }

  async banners(branchId: string) {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        AND: [{ OR: [{ isGlobal: true }, { branches: { some: { branchId } } }] }],
      },
      select: {
        id: true,
        title: true,
        type: true,
        image: true,
        mobileImage: true,
        ctaLabel: true,
        ctaUrl: true,
        body: true,
        priority: true,
      },
      orderBy: { priority: 'asc' },
    });
  }

  /** Aggregated homepage payload: banners, featured products, best sellers, new arrivals. */
  async home(branchId: string) {
    const [banners, categories, brands, newArrivals, bestSellerRows] = await Promise.all([
      this.banners(branchId),
      this.categories(branchId),
      this.brands(branchId),
      this.products({ branchId, page: 1, pageSize: 8, sort: 'newest' }),
      this.prisma.orderItem.groupBy({
        by: ['variantId'],
        where: { order: { branchId, status: { notIn: ['CANCELLED', 'REFUNDED'] } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 8,
      }),
    ]);

    const bestSellerVariantIds = bestSellerRows.map((r) => r.variantId);
    const bestSellers =
      bestSellerVariantIds.length > 0
        ? await this.prisma.branchProduct.findMany({
            where: {
              branchId,
              variantId: { in: bestSellerVariantIds },
              isVisible: true,
              product: { status: 'ACTIVE', deletedAt: null },
            },
            include: {
              product: {
                select: { id: true, name: true, slug: true, brand: true, images: true },
              },
            },
          })
        : [];

    return {
      banners,
      categories: categories.filter((c) => !c.parentId),
      brands,
      newArrivals: newArrivals.items,
      bestSellers: bestSellers.map((bp) => ({
        productId: bp.productId,
        variantId: bp.variantId,
        name: bp.product.name,
        slug: bp.product.slug,
        brand: bp.product.brand,
        images: bp.product.images,
        price: bp.sellingPrice,
        salePrice: bp.salePrice,
      })),
    };
  }
}

function levelOf(available: number): 'OUT_OF_STOCK' | 'LOW' | 'IN_STOCK' {
  if (available <= 0) return 'OUT_OF_STOCK';
  if (available <= 10) return 'LOW';
  return 'IN_STOCK';
}
