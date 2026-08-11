import { Inject, Injectable, Logger, HttpException } from '@nestjs/common';
import type { Prisma } from '@repo/database';
import type { CheckoutInput } from '@repo/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { CartsService } from '../carts/carts.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PricingService } from '../promotions/pricing.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/payment-provider.interface';
import { Errors } from '../../common/errors';
import type { AuthenticatedCustomer } from '../../common/auth-context';
import { ensureOrderNumberSequence, nextOrderNumber } from '../../common/order-number';

const RESERVATION_TTL_MS = 15 * 60 * 1000; // 15 minutes to complete payment.

/**
 * Checkout orchestration.
 *
 * Transaction boundary design: stock reservation + order creation are atomic
 * in ONE database transaction. The Stripe call happens AFTER the transaction
 * commits (never hold a DB transaction open across a network call); if the
 * provider call fails, a compensating action releases the reservation.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger('Checkout');

  constructor(
    private readonly prisma: PrismaService,
    private readonly carts: CartsService,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly pricing: PricingService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async checkout(customer: AuthenticatedCustomer, cartToken: string | undefined, input: CheckoutInput) {
    await ensureOrderNumberSequence(this.prisma);

    const cart = await this.carts.requireCart(cartToken);
    if (cart.id !== input.cartId) throw Errors.notFound('Cart');
    await this.carts.attachCustomer(cart, customer.id);

    // Server-side revalidation of availability, stock, and prices.
    const view = await this.carts.view(cart, customer.id);
    if (view.items.length === 0) throw Errors.badRequest('EMPTY_CART', 'Your cart is empty.');
    if (view.hasProblems) {
      throw Errors.conflict('CART_INVALID', 'Some items are unavailable. Review your cart before checkout.');
    }

    const branch = await this.prisma.branch.findUniqueOrThrow({ where: { id: cart.branchId } });
    if (input.fulfilmentType === 'DELIVERY' && !branch.deliveryEnabled) {
      throw Errors.badRequest('DELIVERY_UNAVAILABLE', 'This branch does not offer delivery.');
    }
    if (input.fulfilmentType === 'CLICK_AND_COLLECT' && !branch.clickCollectEnabled) {
      throw Errors.badRequest('COLLECTION_UNAVAILABLE', 'This branch does not offer click & collect.');
    }

    // Resolve delivery address.
    let addressId: string | null = null;
    let addressSnapshot: Prisma.InputJsonValue | undefined;
    if (input.fulfilmentType === 'DELIVERY') {
      if (input.deliveryAddressId) {
        const address = await this.prisma.address.findFirst({
          where: { id: input.deliveryAddressId, customerId: customer.id, deletedAt: null },
        });
        if (!address) throw Errors.notFound('Address');
        addressId = address.id;
        addressSnapshot = snapshotAddress(address);
      } else if (input.deliveryAddress) {
        const address = await this.prisma.address.create({
          data: { ...input.deliveryAddress, customerId: customer.id },
        });
        addressId = address.id;
        addressSnapshot = snapshotAddress(address);
      } else {
        throw Errors.badRequest('ADDRESS_REQUIRED', 'A delivery address is required for delivery orders.');
      }
    }

    // Recompute totals for the chosen fulfilment type (delivery fee differs).
    const pricing = await this.pricingFor(cart.branchId, view, input.fulfilmentType, cart.couponCode, customer.id);

    // Atomic: reserve stock + create order. Conditional UPDATEs prevent oversell.
    const order = await this.prisma.$transaction(async (tx) => {
      // Sequence avoids table-wide count() contention under concurrent checkouts.
      const orderNumber = await nextOrderNumber(tx);

      for (const item of view.items) {
        const reserved = await this.inventory.reserveWithinTx(tx, {
          branchId: cart.branchId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          reference: orderNumber,
        });
        if (!reserved) {
          throw Errors.insufficientStock(item.variantName);
        }
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          branchId: cart.branchId,
          customerId: customer.id,
          status: 'PAYMENT_PENDING',
          source: 'ONLINE',
          fulfilmentType: input.fulfilmentType,
          deliveryAddressId: addressId,
          deliveryAddress: addressSnapshot,
          contactEmail: customer.email,
          contactPhone: input.contactPhone,
          subtotal: pricing.subtotal,
          discountTotal: pricing.discountTotal,
          taxTotal: pricing.taxTotal,
          deliveryFee: pricing.deliveryFee,
          total: pricing.total,
          currency: branch.currency,
          couponCode: pricing.couponValid ? cart.couponCode : null,
          promotionsApplied: pricing.appliedPromotions as unknown as Prisma.InputJsonValue,
          notes: input.notes,
          items: {
            create: view.items.map((item) => {
              const priced = pricing.lines.find((l) => l.variantId === item.variantId);
              const unitPrice = priced?.discountedUnitPrice ?? item.unitPrice;
              const lineTotal = priced?.lineTotal ?? item.unitPrice * item.quantity;
              return {
                productId: item.productId,
                variantId: item.variantId,
                productName: item.name,
                variantName: item.variantName,
                sku: '',
                quantity: item.quantity,
                unitPrice,
                originalUnitPrice: item.originalUnitPrice,
                lineTotal,
                taxAmount: Math.round((lineTotal * branch.taxRateBps) / (10000 + branch.taxRateBps)),
              };
            }),
          },
          statusHistory: { create: [{ to: 'PAYMENT_PENDING', isSystem: true }] },
        },
        include: { items: true },
      });

      // SKU snapshots for items (variant lookup inside the same tx).
      for (const item of created.items) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (variant) {
          await tx.orderItem.update({ where: { id: item.id }, data: { sku: variant.sku } });
        }
      }

      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
      await tx.stockReservation.createMany({
        data: created.items.map((item) => ({
          branchId: cart.branchId,
          productId: item.productId,
          variantId: item.variantId,
          orderId: created.id,
          quantity: item.quantity,
          expiresAt,
        })),
      });

      await tx.cart.update({ where: { id: cart.id }, data: { status: 'CHECKED_OUT' } });
      return created;
    });

    // Provider call AFTER the transaction. Compensate on failure.
    let clientSecret: string | null = null;
    let providerPaymentId: string;
    try {
      const paymentResult = await this.provider.createPayment({
        amount: order.total,
        currency: branch.currency,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail: customer.email,
        idempotencyKey: `order:${order.id}`,
      });
      clientSecret = paymentResult.clientSecret;
      providerPaymentId = paymentResult.providerPaymentId;
    } catch (error) {
      this.logger.error(`Payment creation failed for ${order.orderNumber}: ${String(error)}`);
      await this.releaseOrder(order.id, 'Payment provider error');
      if (error instanceof HttpException) throw error;
      const message =
        error instanceof Error && error.message
          ? `Payment could not be started: ${error.message}`
          : 'Payment could not be started. Check Stripe configuration and try again.';
      throw Errors.badRequest('PAYMENT_CREATE_FAILED', message);
    }

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        status: 'PENDING',
        provider: this.provider.name,
        providerPaymentId,
        amount: order.total,
        currency: branch.currency,
      },
    });

    await this.notifications.queueOrderEvent('order.created', order.id);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      clientSecret,
      reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS).toISOString(),
    };
  }

  /**
   * Post-payment client confirmation: verifies with the provider server-side.
   * The client saying "paid" is only a trigger for verification, never trusted.
   */
  async confirmOrder(customer: AuthenticatedCustomer, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: customer.id },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw Errors.notFound('Order');
    const payment = order.payments[0];
    if (!payment) throw Errors.notFound('Payment');

    if (payment.status !== 'SUCCEEDED') {
      const state = await this.provider.getPayment(payment.providerPaymentId);
      if (state.status === 'SUCCEEDED') {
        await this.payments.markSucceeded(payment.id);
      } else if (state.status === 'FAILED' || state.status === 'CANCELLED') {
        await this.payments.markFailed(payment.id, state.failureReason ?? 'Payment unsuccessful.');
      }
    }

    const fresh = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { id: true, orderNumber: true, status: true, total: true, currency: true },
    });
    return fresh;
  }

  /** Release reservations and cancel an order (compensation / expiry). */
  async releaseOrder(orderId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || (order.status !== 'PENDING' && order.status !== 'PAYMENT_PENDING')) return;

      for (const item of order.items) {
        await this.inventory.releaseWithinTx(tx, {
          branchId: order.branchId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          reference: order.orderNumber,
        });
      }
      await tx.stockReservation.updateMany({
        where: { orderId, status: 'ACTIVE' },
        data: { status: 'RELEASED' },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, from: order.status, to: 'CANCELLED', isSystem: true, notes: reason },
      });
    });
  }

  private async pricingFor(
    branchId: string,
    view: Awaited<ReturnType<CartsService['view']>>,
    fulfilmentType: 'DELIVERY' | 'CLICK_AND_COLLECT',
    couponCode: string | null,
    customerId: string,
  ) {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: view.id },
      include: {
        variant: {
          include: {
            product: { select: { brand: true, categories: { select: { categoryId: true } } } },
          },
        },
      },
    });
    const branchProducts = await this.prisma.branchProduct.findMany({
      where: { branchId, variantId: { in: items.map((i) => i.variantId) } },
    });
    const bpByVariant = new Map(branchProducts.map((bp) => [bp.variantId, bp]));

    return this.pricing.price({
      branchId,
      fulfilmentType,
      couponCode,
      customerId,
      lines: items.map((item) => {
        const bp = bpByVariant.get(item.variantId);
        return {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: bp ? (bp.salePrice ?? bp.sellingPrice) : 0,
          categoryIds: item.variant.product.categories.map((c) => c.categoryId),
          brand: item.variant.product.brand,
        };
      }),
    });
  }
}

function snapshotAddress(address: {
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  country: string;
  phone: string | null;
}): Prisma.InputJsonValue {
  return {
    recipientName: address.recipientName,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    postcode: address.postcode,
    country: address.country,
    phone: address.phone,
  };
}
