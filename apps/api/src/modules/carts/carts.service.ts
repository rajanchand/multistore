import { Injectable } from '@nestjs/common';
import { generateToken, hashToken } from '@repo/auth';
import type { Cart } from '@repo/database';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingService, type PricingLineInput } from '../promotions/pricing.service';
import { Errors } from '../../common/errors';

/**
 * Carts are identified by an opaque cart token (hashed at rest) so guests can
 * shop; checkout later binds the cart to the authenticated customer. Prices
 * are recomputed server-side on every read — the client never supplies money.
 */
@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async createCart(branchId: string, customerId?: string): Promise<{ cart: Cart; token: string }> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, isActive: true, deletedAt: null },
    });
    if (!branch) throw Errors.notFound('Branch');

    const token = generateToken();
    const cart = await this.prisma.cart.create({
      data: { branchId, customerId, guestTokenHash: hashToken(token) },
    });
    return { cart, token };
  }

  async findByToken(token: string): Promise<Cart | null> {
    return this.prisma.cart.findFirst({
      where: { guestTokenHash: hashToken(token), status: 'ACTIVE' },
    });
  }

  async requireCart(token: string | undefined): Promise<Cart> {
    if (!token) throw Errors.notFound('Cart');
    const cart = await this.findByToken(token);
    if (!cart) throw Errors.notFound('Cart');
    return cart;
  }

  /** Full cart payload with authoritative pricing. */
  async view(cart: Cart, customerId?: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                brand: true,
                images: true,
                status: true,
                categories: { select: { categoryId: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const branchProducts = await this.prisma.branchProduct.findMany({
      where: { branchId: cart.branchId, variantId: { in: items.map((i) => i.variantId) } },
    });
    const bpByVariant = new Map(branchProducts.map((bp) => [bp.variantId, bp]));
    const inventory = await this.prisma.inventory.findMany({
      where: { branchId: cart.branchId, variantId: { in: items.map((i) => i.variantId) } },
    });
    const stockByVariant = new Map(inventory.map((i) => [i.variantId, i.available]));

    const validLines: PricingLineInput[] = [];
    const displayItems = items.map((item) => {
      const bp = bpByVariant.get(item.variantId);
      const available = stockByVariant.get(item.variantId) ?? 0;
      const problems: string[] = [];
      if (!bp || !bp.isVisible || item.variant.product.status !== 'ACTIVE') {
        problems.push('NOT_AVAILABLE_AT_BRANCH');
      } else {
        if (!bp.isAvailable) problems.push('UNAVAILABLE');
        if (available < item.quantity) problems.push('INSUFFICIENT_STOCK');
        if (item.quantity < bp.minimumOrderQuantity) problems.push('BELOW_MINIMUM_QUANTITY');
        if (bp.maximumOrderQuantity != null && item.quantity > bp.maximumOrderQuantity) {
          problems.push('ABOVE_MAXIMUM_QUANTITY');
        }
      }
      const unitPrice = bp ? (bp.salePrice ?? bp.sellingPrice) : 0;
      if (problems.length === 0 && bp) {
        validLines.push({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice,
          categoryIds: item.variant.product.categories.map((c) => c.categoryId),
          brand: item.variant.product.brand,
        });
      }
      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        name: item.variant.product.name,
        variantName: item.variant.name,
        slug: item.variant.product.slug,
        images: item.variant.product.images,
        attributes: item.variant.attributes,
        quantity: item.quantity,
        unitPrice,
        originalUnitPrice: bp?.sellingPrice ?? 0,
        available,
        problems,
      };
    });

    const totals = await this.pricing.price({
      branchId: cart.branchId,
      lines: validLines,
      fulfilmentType: 'DELIVERY',
      couponCode: cart.couponCode,
      customerId,
    });

    const branch = await this.prisma.branch.findUniqueOrThrow({
      where: { id: cart.branchId },
      select: {
        id: true,
        name: true,
        slug: true,
        deliveryEnabled: true,
        clickCollectEnabled: true,
        deliveryFee: true,
        freeDeliveryThreshold: true,
      },
    });

    return {
      id: cart.id,
      branch,
      couponCode: cart.couponCode,
      items: displayItems,
      totals: {
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        deliveryFee: totals.deliveryFee,
        taxTotal: totals.taxTotal,
        total: totals.total,
        appliedPromotions: totals.appliedPromotions,
        freeDelivery: totals.freeDelivery,
        couponValid: totals.couponValid,
        couponError: totals.couponError,
      },
      hasProblems: displayItems.some((i) => i.problems.length > 0),
    };
  }

  async addItem(cart: Cart, input: { productId: string; variantId?: string | null; quantity: number }) {
    const variantId =
      input.variantId ??
      (
        await this.prisma.productVariant.findFirstOrThrow({
          where: { productId: input.productId, isDefault: true, deletedAt: null },
        })
      ).id;

    const bp = await this.prisma.branchProduct.findUnique({
      where: { branchId_variantId: { branchId: cart.branchId, variantId } },
    });
    if (!bp || !bp.isVisible || !bp.isAvailable) {
      throw Errors.conflict('NOT_AVAILABLE', 'This product is not available at the selected branch.');
    }

    const inventory = await this.prisma.inventory.findUnique({
      where: { branchId_variantId: { branchId: cart.branchId, variantId } },
    });
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    const newQuantity = (existing?.quantity ?? 0) + input.quantity;
    if ((inventory?.available ?? 0) < newQuantity) {
      throw Errors.insufficientStock();
    }
    if (bp.maximumOrderQuantity != null && newQuantity > bp.maximumOrderQuantity) {
      throw Errors.conflict('MAX_QUANTITY', `Maximum ${bp.maximumOrderQuantity} per order.`);
    }

    if (existing) {
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQuantity },
      });
    }
    return this.prisma.cartItem.create({
      data: { cartId: cart.id, productId: input.productId, variantId, quantity: newQuantity },
    });
  }

  async updateItem(cart: Cart, itemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw Errors.notFound('Cart item');
    if (quantity === 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
      return null;
    }
    const inventory = await this.prisma.inventory.findUnique({
      where: { branchId_variantId: { branchId: cart.branchId, variantId: item.variantId } },
    });
    if ((inventory?.available ?? 0) < quantity) throw Errors.insufficientStock();
    return this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  }

  async removeItem(cart: Cart, itemId: string) {
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
  }

  async applyCoupon(cart: Cart, code: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt < new Date())) {
      throw Errors.badRequest('INVALID_COUPON', 'This coupon code is invalid or has expired.');
    }
    return this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: code } });
  }

  async removeCoupon(cart: Cart) {
    return this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
  }

  /**
   * Switch the cart to another branch. Items are kept but revalidated against
   * the new branch's catalogue on next view — stale prices are impossible
   * because prices are always derived from the current branch config.
   */
  async switchBranch(cart: Cart, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, isActive: true, deletedAt: null, code: { not: 'HQ' } },
    });
    if (!branch) throw Errors.notFound('Branch');
    return this.prisma.cart.update({ where: { id: cart.id }, data: { branchId } });
  }

  async attachCustomer(cart: Cart, customerId: string) {
    if (cart.customerId && cart.customerId !== customerId) {
      throw Errors.forbidden('This cart belongs to another customer.');
    }
    if (!cart.customerId) {
      return this.prisma.cart.update({ where: { id: cart.id }, data: { customerId } });
    }
    return cart;
  }
}
