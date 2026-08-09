import { Injectable } from '@nestjs/common';
import { percentOf } from '@repo/types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Server-authoritative pricing. The storefront NEVER sends prices; it sends
 * (branch, variant, quantity) and this service computes everything else.
 *
 * Promotion determinism:
 *  1. Applicable promotions are ordered by (priority ASC, id ASC).
 *  2. Non-stackable: the first (best-priority) promotion wins per line.
 *  3. Stackable promotions apply after non-stackable ones, same ordering.
 *  4. Coupon promotions only apply when the coupon is attached to the cart.
 */

export interface PricingLineInput {
  productId: string;
  variantId: string;
  quantity: number;
  /** Unit price from BranchProduct (sale price already the branch's base when set). */
  unitPrice: number;
  categoryIds: string[];
  brand: string | null;
}

export interface PricedLine extends PricingLineInput {
  discountedUnitPrice: number;
  lineDiscount: number;
  lineTotal: number;
  appliedPromotionIds: string[];
}

export interface PricingResult {
  lines: PricedLine[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  taxTotal: number;
  total: number;
  appliedPromotions: { id: string; name: string; type: string }[];
  freeDelivery: boolean;
  couponValid: boolean;
  couponError?: string;
}

interface ActivePromotion {
  id: string;
  name: string;
  type: string;
  value: number;
  buyQuantity: number | null;
  getQuantity: number | null;
  minimumSpend: number | null;
  priority: number;
  isStackable: boolean;
  brand: string | null;
  productIds: Set<string>;
  categoryIds: Set<string>;
  couponOnly: boolean;
  couponCode?: string;
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Load promotions active for a branch right now (including coupon-gated ones). */
  async activePromotionsFor(branchId: string): Promise<ActivePromotion[]> {
    const now = new Date();
    const promotions = await this.prisma.promotion.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        AND: [{ OR: [{ allBranches: true }, { branches: { some: { branchId } } }] }],
      },
      include: {
        products: { select: { productId: true } },
        categories: { select: { categoryId: true } },
        coupons: { where: { isActive: true }, select: { code: true } },
      },
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    });

    return promotions.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      value: p.value,
      buyQuantity: p.buyQuantity,
      getQuantity: p.getQuantity,
      minimumSpend: p.minimumSpend,
      priority: p.priority,
      isStackable: p.isStackable,
      brand: p.brand,
      productIds: new Set(p.products.map((x) => x.productId)),
      categoryIds: new Set(p.categories.map((x) => x.categoryId)),
      couponOnly: p.coupons.length > 0,
      couponCode: p.coupons[0]?.code,
    }));
  }

  /**
   * Price a set of lines for a branch. Pure computation once promotions are
   * loaded — unit-testable without a database via `priceLines`.
   */
  async price(params: {
    branchId: string;
    lines: PricingLineInput[];
    fulfilmentType: 'DELIVERY' | 'CLICK_AND_COLLECT';
    couponCode?: string | null;
    customerId?: string;
  }): Promise<PricingResult> {
    const branch = await this.prisma.branch.findUniqueOrThrow({ where: { id: params.branchId } });
    const promotions = await this.activePromotionsFor(params.branchId);

    let couponValid = false;
    let couponError: string | undefined;
    let couponPromotionIds = new Set<string>();

    if (params.couponCode) {
      const coupon = await this.prisma.coupon.findUnique({
        where: { code: params.couponCode },
        include: { promotion: true },
      });
      if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt < new Date())) {
        couponError = 'This coupon code is invalid or has expired.';
      } else if (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions) {
        couponError = 'This coupon has reached its redemption limit.';
      } else if (params.customerId) {
        const used = await this.prisma.couponRedemption.count({
          where: { couponId: coupon.id, customerId: params.customerId },
        });
        if (used >= coupon.maxRedemptionsPerCustomer) {
          couponError = 'You have already used this coupon.';
        } else {
          couponValid = true;
          couponPromotionIds = new Set([coupon.promotionId]);
        }
      } else {
        couponValid = true;
        couponPromotionIds = new Set([coupon.promotionId]);
      }
    }

    const result = this.priceLines({
      lines: params.lines,
      promotions,
      couponPromotionIds,
      taxRateBps: branch.taxRateBps,
      fulfilment: params.fulfilmentType,
      deliveryFee: branch.deliveryFee,
      freeDeliveryThreshold: branch.freeDeliveryThreshold,
    });

    return { ...result, couponValid, couponError };
  }

  /** Pure pricing computation (unit-tested directly). */
  priceLines(params: {
    lines: PricingLineInput[];
    promotions: ActivePromotion[];
    couponPromotionIds: Set<string>;
    taxRateBps: number;
    fulfilment: 'DELIVERY' | 'CLICK_AND_COLLECT';
    deliveryFee: number;
    freeDeliveryThreshold: number | null;
  }): Omit<PricingResult, 'couponValid' | 'couponError'> {
    const rawSubtotal = params.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const applied = new Map<string, { id: string; name: string; type: string }>();
    let freeDelivery = false;

    const usablePromotions = params.promotions.filter((p) => {
      if (p.couponOnly && !params.couponPromotionIds.has(p.id)) return false;
      if (p.minimumSpend != null && rawSubtotal < p.minimumSpend) return false;
      return true;
    });

    const lines: PricedLine[] = params.lines.map((line) => {
      const matching = usablePromotions.filter((p) => this.appliesToLine(p, line));
      let discountedUnitPrice = line.unitPrice;
      let lineDiscount = 0;
      const appliedIds: string[] = [];

      const nonStackable = matching.filter((p) => !p.isStackable && p.type !== 'FREE_DELIVERY');
      const stackable = matching.filter((p) => p.isStackable && p.type !== 'FREE_DELIVERY');
      const chain = [...(nonStackable.length > 0 ? [nonStackable[0]!] : []), ...stackable];

      for (const promo of chain) {
        const before = discountedUnitPrice * line.quantity - lineDiscount;
        const discount = this.lineDiscountFor(promo, line, discountedUnitPrice);
        if (discount <= 0) continue;
        lineDiscount += Math.min(discount, before);
        appliedIds.push(promo.id);
        applied.set(promo.id, { id: promo.id, name: promo.name, type: promo.type });
      }

      for (const promo of matching.filter((p) => p.type === 'FREE_DELIVERY')) {
        freeDelivery = true;
        applied.set(promo.id, { id: promo.id, name: promo.name, type: promo.type });
      }

      const lineTotal = line.unitPrice * line.quantity - lineDiscount;
      discountedUnitPrice = line.quantity > 0 ? Math.round(lineTotal / line.quantity) : line.unitPrice;
      return { ...line, discountedUnitPrice, lineDiscount, lineTotal, appliedPromotionIds: appliedIds };
    });

    const subtotal = rawSubtotal;
    const discountTotal = lines.reduce((s, l) => s + l.lineDiscount, 0);
    const goodsTotal = subtotal - discountTotal;

    let deliveryFee = 0;
    if (params.fulfilment === 'DELIVERY' && !freeDelivery) {
      deliveryFee =
        params.freeDeliveryThreshold != null && goodsTotal >= params.freeDeliveryThreshold
          ? 0
          : params.deliveryFee;
    }

    // UK model: prices are VAT-inclusive. Tax portion = total * rate / (10000 + rate).
    const taxTotal = Math.round(((goodsTotal + deliveryFee) * params.taxRateBps) / (10000 + params.taxRateBps));
    const total = goodsTotal + deliveryFee;

    return {
      lines,
      subtotal,
      discountTotal,
      deliveryFee,
      taxTotal,
      total,
      appliedPromotions: [...applied.values()],
      freeDelivery,
    };
  }

  private appliesToLine(promo: ActivePromotion, line: PricingLineInput): boolean {
    const hasScope =
      promo.productIds.size > 0 || promo.categoryIds.size > 0 || promo.brand != null;
    if (!hasScope) return true; // Branch-wide promotion.
    if (promo.productIds.has(line.productId)) return true;
    if (promo.brand && line.brand && promo.brand.toLowerCase() === line.brand.toLowerCase()) return true;
    return line.categoryIds.some((c) => promo.categoryIds.has(c));
  }

  private lineDiscountFor(promo: ActivePromotion, line: PricingLineInput, unitPrice: number): number {
    switch (promo.type) {
      case 'PERCENTAGE':
        return percentOf(unitPrice * line.quantity, promo.value / 100);
      case 'FIXED_AMOUNT':
        return Math.min(promo.value, unitPrice) * line.quantity;
      case 'BOGO': {
        const freeUnits = Math.floor(line.quantity / 2);
        return freeUnits * unitPrice;
      }
      case 'BUY_X_GET_Y': {
        const buy = promo.buyQuantity ?? 1;
        const get = promo.getQuantity ?? 0;
        if (get === 0) return 0;
        const groups = Math.floor(line.quantity / (buy + get));
        return groups * get * unitPrice;
      }
      default:
        return 0;
    }
  }
}
