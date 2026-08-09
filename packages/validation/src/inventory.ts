import { z } from 'zod';
import { uuidSchema } from './common';

export const adjustInventorySchema = z.object({
  branchId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema.nullable().optional(),
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, { message: 'Delta cannot be zero' }),
  movementType: z.enum(['PURCHASE', 'RETURN', 'DAMAGED', 'LOST', 'MANUAL_ADJUSTMENT']),
  reason: z.string().trim().min(2).max(500),
});
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;

export const createTransferSchema = z.object({
  fromBranchId: uuidSchema,
  toBranchId: uuidSchema,
  notes: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: uuidSchema,
        variantId: uuidSchema.nullable().optional(),
        quantity: z.number().int().min(1).max(100000),
      }),
    )
    .min(1)
    .max(200),
});
export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export const transferTransitionSchema = z.object({
  status: z.enum(['APPROVED', 'PREPARING', 'IN_TRANSIT', 'RECEIVED', 'REJECTED', 'CANCELLED']),
  notes: z.string().trim().max(1000).optional(),
});
export type TransferTransitionInput = z.infer<typeof transferTransitionSchema>;

export const setLowStockThresholdSchema = z.object({
  branchId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema.nullable().optional(),
  lowStockThreshold: z.number().int().min(0).max(100000),
});
export type SetLowStockThresholdInput = z.infer<typeof setLowStockThresholdSchema>;
