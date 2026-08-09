import { z } from 'zod';
import { moneySchema, slugSchema, uuidSchema } from './common';

export const createFaqSchema = z.object({
  question: z.string().trim().min(3).max(500),
  answer: z.string().trim().min(3).max(10000),
  category: z.string().trim().min(1).max(80).default('General'),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  isPublished: z.boolean().default(true),
});
export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export const updateFaqSchema = createFaqSchema.partial();
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;

export const upsertAboutSchema = z.object({
  sectionKey: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,40}$/),
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(1).max(50000),
  isPublished: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});
export type UpsertAboutInput = z.infer<typeof upsertAboutSchema>;

export const createPaymentMethodSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,32}$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  provider: z.string().trim().min(2).max(80),
  isEnabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  config: z.record(z.unknown()).optional(),
});
export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export const updatePaymentMethodSchema = createPaymentMethodSchema.partial().omit({ code: true });
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;

export const campaignFieldsSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: slugSchema,
  description: z.string().trim().max(2000).optional(),
  channel: z.enum(['EMAIL', 'SMS', 'IN_APP', 'BANNER', 'MULTI']).default('MULTI'),
  status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).default('DRAFT'),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  content: z
    .object({
      subject: z.string().trim().max(200).optional(),
      body: z.string().trim().max(10000).optional(),
      ctaLabel: z.string().trim().max(80).optional(),
      ctaUrl: z.string().trim().max(500).optional(),
    })
    .optional(),
  audience: z
    .object({
      segment: z.enum(['all_customers', 'marketing_opt_in', 'branch_customers']).optional(),
    })
    .optional(),
  branchIds: z.array(uuidSchema).default([]),
});

export const createCampaignSchema = campaignFieldsSchema.refine(
  (v) => !v.endsAt || !v.startsAt || v.endsAt > v.startsAt,
  {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  },
);
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = campaignFieldsSchema.partial().refine(
  (v) => !v.endsAt || !v.startsAt || v.endsAt > v.startsAt,
  {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  },
);
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const sendSmsSchema = z
  .object({
    body: z.string().trim().min(1).max(1600),
    toPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s()-]{7,20}$/)
      .optional(),
    customerId: uuidSchema.optional(),
    branchId: uuidSchema.optional(),
    campaignId: uuidSchema.optional(),
    segment: z.enum(['all_customers', 'marketing_opt_in', 'branch_customers']).optional(),
  })
  .refine((v) => Boolean(v.toPhone || v.customerId || v.segment), {
    message: 'Provide toPhone, customerId, or a bulk segment',
    path: ['toPhone'],
  })
  .refine((v) => v.segment !== 'branch_customers' || Boolean(v.branchId), {
    message: 'branchId is required for branch_customers segment',
    path: ['branchId'],
  });
export type SendSmsInput = z.infer<typeof sendSmsSchema>;

const optionalUrl = z.union([z.literal(''), z.string().trim().url().max(500)]).optional();
const optionalText = (max: number) => z.union([z.literal(''), z.string().trim().max(max)]).optional();

export const storeDetailsSchema = z.object({
  storeName: z.string().trim().min(2).max(150),
  legalName: optionalText(200),
  supportEmail: z.union([z.literal(''), z.string().trim().email().max(200)]).optional(),
  supportPhone: optionalText(40),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(100),
  postcode: optionalText(20),
  country: z.string().trim().min(2).max(2).default('GB'),
  website: optionalUrl,
  logoUrl: optionalUrl,
  timezone: z.string().trim().min(2).max(80).default('Europe/London'),
  currency: z.string().trim().length(3).default('GBP'),
  vatNumber: optionalText(40),
  companyNumber: optionalText(40),
  tagline: optionalText(300),
});
export type StoreDetailsInput = z.infer<typeof storeDetailsSchema>;

export const socialLinksSchema = z.object({
  facebook: optionalUrl,
  instagram: optionalUrl,
  x: optionalUrl,
  tiktok: optionalUrl,
  youtube: optionalUrl,
  linkedin: optionalUrl,
});
export type SocialLinksInput = z.infer<typeof socialLinksSchema>;

export const deliveryDefaultsSchema = z.object({
  defaultDeliveryFee: moneySchema,
  defaultFreeDeliveryThreshold: moneySchema.nullable().optional(),
  deliveryNotes: optionalText(2000),
  estimatedDeliveryHours: optionalText(80),
  minOrderForDelivery: moneySchema.nullable().optional(),
});
export type DeliveryDefaultsInput = z.infer<typeof deliveryDefaultsSchema>;

export const updatePluginSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  isEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  config: z.record(z.unknown()).optional(),
});
export type UpdatePluginInput = z.infer<typeof updatePluginSchema>;
