import { z } from 'zod';
import { moneySchema, slugSchema } from './common';

export const openingHoursSchema = z.record(
  z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  z
    .object({
      open: z.string().regex(/^\d{2}:\d{2}$/),
      close: z.string().regex(/^\d{2}:\d{2}$/),
      closed: z.boolean().default(false),
    })
    .optional(),
);

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,12}$/, '2-12 chars: letters, digits, - or _'),
  slug: slugSchema,
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  postcode: z.string().trim().min(2).max(12),
  country: z.string().trim().length(2).default('GB'),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(320).optional(),
  timezone: z.string().max(50).default('Europe/London'),
  currency: z.string().length(3).default('GBP'),
  taxRateBps: z.number().int().min(0).max(10000).default(2000),
  deliveryEnabled: z.boolean().default(true),
  clickCollectEnabled: z.boolean().default(true),
  deliveryFee: moneySchema.default(399),
  freeDeliveryThreshold: moneySchema.nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  openingHours: openingHoursSchema.optional(),
  managerUserId: z.string().uuid().optional(),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema.partial();
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

/** UK postcode or outward code for nearest-branch lookup. */
export const nearestBranchQuerySchema = z.object({
  postcode: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .transform((v) => v.toUpperCase().replace(/\s+/g, ' ')),
});
export type NearestBranchQuery = z.infer<typeof nearestBranchQuerySchema>;
