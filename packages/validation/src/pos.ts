import { z } from 'zod';
import { uuidSchema } from './common';

/** Barcode scanner / manual SKU lookup for the till. */
export const posLookupQuerySchema = z.object({
  branchId: uuidSchema,
  /** Exact barcode, GTIN-style code, or SKU from the scanner wedge / keypad. */
  code: z.string().trim().min(1).max(64),
});
export type PosLookupQuery = z.infer<typeof posLookupQuerySchema>;

const posSaleLineSchema = z.object({
  variantId: uuidSchema,
  quantity: z.number().int().min(1).max(999),
});

/** Complete a POS sale (cash or card terminal). */
export const posSaleSchema = z.object({
  branchId: uuidSchema,
  paymentType: z.enum(['CASH', 'CARD']),
  items: z.array(posSaleLineSchema).min(1).max(100),
  notes: z.string().trim().max(1000).optional(),
  /** Optional tendered amount in minor units (cash change display). */
  amountTendered: z.number().int().min(0).max(100_000_000).optional(),
});
export type PosSaleInput = z.infer<typeof posSaleSchema>;

export const posTerminalActionSchema = z.object({
  /** Simulated card brand for approve (dev / mock terminal). */
  cardBrand: z.enum(['visa', 'mastercard', 'amex']).optional(),
  last4: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  reason: z.string().trim().max(500).optional(),
});
export type PosTerminalActionInput = z.infer<typeof posTerminalActionSchema>;
