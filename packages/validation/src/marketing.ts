import { z } from 'zod';
import { moneySchema, uuidSchema } from './common';

export const createPromotionSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    description: z.string().trim().max(1000).optional(),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BOGO', 'BUY_X_GET_Y', 'FREE_DELIVERY']),
    // PERCENTAGE: basis points (1000 = 10%). FIXED_AMOUNT: minor units.
    value: z.number().int().min(0).max(1_000_000).default(0),
    buyQuantity: z.number().int().min(1).max(100).optional(),
    getQuantity: z.number().int().min(1).max(100).optional(),
    minimumSpend: moneySchema.nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullable().optional(),
    priority: z.number().int().min(0).max(1000).default(100),
    isStackable: z.boolean().default(false),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).default('DRAFT'),
    branchIds: z.array(uuidSchema).default([]),
    productIds: z.array(uuidSchema).default([]),
    categoryIds: z.array(uuidSchema).default([]),
    brand: z.string().trim().max(120).optional(),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
  .refine((v) => v.type !== 'PERCENTAGE' || (v.value > 0 && v.value <= 10000), {
    message: 'Percentage promotions need value in basis points (1-10000)',
    path: ['value'],
  })
  .refine((v) => v.type !== 'BUY_X_GET_Y' || (v.buyQuantity != null && v.getQuantity != null), {
    message: 'BUY_X_GET_Y requires buyQuantity and getQuantity',
    path: ['buyQuantity'],
  });
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

export const createCouponSchema = z.object({
  promotionId: uuidSchema,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,32}$/),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  maxRedemptionsPerCustomer: z.number().int().min(1).max(100).default(1),
  expiresAt: z.coerce.date().nullable().optional(),
});
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

export const bannerFieldsSchema = z.object({
  title: z.string().trim().min(1).max(150),
  type: z.enum(['HERO', 'MOBILE_HERO', 'CATEGORY', 'PROMOTION', 'POPUP', 'ANNOUNCEMENT']),
  image: z.string().url().optional(),
  mobileImage: z.string().url().optional(),
  ctaLabel: z.string().trim().max(50).optional(),
  ctaUrl: z
    .string()
    .max(500)
    .regex(/^\/(?!\/)/, 'CTA destination must be a relative path')
    .optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  isGlobal: z.boolean().default(true),
  branchIds: z.array(uuidSchema).default([]),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
  priority: z.number().int().min(0).max(1000).default(100),
  body: z.string().trim().max(2000).optional(),
});

export const createBannerSchema = bannerFieldsSchema.refine(
  (v) => !v.endsAt || v.endsAt > v.startsAt,
  {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  },
);
export type CreateBannerInput = z.infer<typeof createBannerSchema>;

export const updateBannerSchema = bannerFieldsSchema.partial().refine(
  (v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt,
  {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  },
);
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;
