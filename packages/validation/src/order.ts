import { z } from 'zod';
import { uuidSchema } from './common';

export const addressSchema = z.object({
  label: z.string().trim().max(50).optional(),
  recipientName: z.string().trim().min(1).max(200),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  postcode: z.string().trim().min(2).max(12),
  country: z.string().trim().length(2).default('GB'),
  phone: z.string().trim().max(20).optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutSchema = z.object({
  cartId: uuidSchema,
  fulfilmentType: z.enum(['DELIVERY', 'CLICK_AND_COLLECT']),
  deliveryAddressId: uuidSchema.optional(),
  deliveryAddress: addressSchema.optional(),
  contactPhone: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const orderStatusUpdateSchema = z.object({
  status: z.enum([
    'CONFIRMED',
    'PREPARING',
    'READY_FOR_COLLECTION',
    'DISPATCHED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ]),
  notes: z.string().trim().max(1000).optional(),
});
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;

export const createRefundSchema = z.object({
  orderId: uuidSchema,
  amount: z.number().int().min(1).optional(),
  reason: z.string().trim().min(2).max(500),
  items: z
    .array(
      z.object({
        orderItemId: uuidSchema,
        quantity: z.number().int().min(1),
      }),
    )
    .optional(),
  restock: z.boolean().default(false),
});
export type CreateRefundInput = z.infer<typeof createRefundSchema>;
