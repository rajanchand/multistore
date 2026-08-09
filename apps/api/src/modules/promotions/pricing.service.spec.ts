import { PricingService } from './pricing.service';

describe('PricingService', () => {
  const service = new PricingService(null as never);

  const baseLine = {
    productId: 'p1',
    variantId: 'v1',
    quantity: 2,
    unitPrice: 100,
    categoryIds: ['c1'],
    brand: 'Monster',
  };

  it('computes VAT-inclusive totals without promotions', () => {
    const result = service.priceLines({
      lines: [baseLine],
      promotions: [],
      couponPromotionIds: new Set(),
      taxRateBps: 2000,
      fulfilment: 'CLICK_AND_COLLECT',
      deliveryFee: 399,
      freeDeliveryThreshold: 3000,
    });
    expect(result.subtotal).toBe(200);
    expect(result.discountTotal).toBe(0);
    expect(result.deliveryFee).toBe(0);
    expect(result.total).toBe(200);
    expect(result.taxTotal).toBe(Math.round((200 * 2000) / 12000));
  });

  it('applies percentage promotions in minor units', () => {
    const result = service.priceLines({
      lines: [baseLine],
      promotions: [
        {
          id: 'promo1',
          name: '10% off',
          type: 'PERCENTAGE',
          value: 1000,
          buyQuantity: null,
          getQuantity: null,
          minimumSpend: null,
          priority: 10,
          isStackable: false,
          brand: null,
          productIds: new Set(),
          categoryIds: new Set(),
          couponOnly: false,
        },
      ],
      couponPromotionIds: new Set(),
      taxRateBps: 2000,
      fulfilment: 'CLICK_AND_COLLECT',
      deliveryFee: 0,
      freeDeliveryThreshold: null,
    });
    expect(result.discountTotal).toBe(20);
    expect(result.total).toBe(180);
  });

  it('does not trust delivery fee when free delivery promotion applies', () => {
    const result = service.priceLines({
      lines: [baseLine],
      promotions: [
        {
          id: 'fd',
          name: 'Free delivery',
          type: 'FREE_DELIVERY',
          value: 0,
          buyQuantity: null,
          getQuantity: null,
          minimumSpend: null,
          priority: 1,
          isStackable: true,
          brand: null,
          productIds: new Set(),
          categoryIds: new Set(),
          couponOnly: false,
        },
      ],
      couponPromotionIds: new Set(),
      taxRateBps: 2000,
      fulfilment: 'DELIVERY',
      deliveryFee: 399,
      freeDeliveryThreshold: null,
    });
    expect(result.freeDelivery).toBe(true);
    expect(result.deliveryFee).toBe(0);
  });

  it('ignores coupon-only promotions without a matching coupon', () => {
    const result = service.priceLines({
      lines: [baseLine],
      promotions: [
        {
          id: 'coupon-promo',
          name: 'SAVE10',
          type: 'FIXED_AMOUNT',
          value: 50,
          buyQuantity: null,
          getQuantity: null,
          minimumSpend: null,
          priority: 1,
          isStackable: false,
          brand: null,
          productIds: new Set(),
          categoryIds: new Set(),
          couponOnly: true,
          couponCode: 'SAVE10',
        },
      ],
      couponPromotionIds: new Set(),
      taxRateBps: 2000,
      fulfilment: 'CLICK_AND_COLLECT',
      deliveryFee: 0,
      freeDeliveryThreshold: null,
    });
    expect(result.discountTotal).toBe(0);
  });
});
