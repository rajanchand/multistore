import { z } from 'zod';
import { uuidSchema } from './common';

export const addCartItemSchema = z.object({
  branchId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema.nullable().optional(),
  quantity: z.number().int().min(1).max(999),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(999),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const applyCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,32}$/),
});
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
