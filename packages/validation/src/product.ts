import { z } from 'zod';
import { moneySchema, slugSchema, uuidSchema } from './common';

export const productStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);

export const variantAttributesSchema = z.record(z.string().max(50), z.string().max(100));

/** http(s) image URLs or data:image uploads used in local/dev without S3. */
export const productImageSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_000_000)
  .refine(
    (v) => v.startsWith('data:image/') || /^https?:\/\/.+/i.test(v),
    { message: 'Image must be an http(s) URL or data:image upload' },
  );

/** Empty string clears barcode; omit leaves unchanged on update. */
const barcodeField = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().trim().max(64).nullable().optional(),
);

export const createVariantSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  barcode: barcodeField,
  name: z.string().trim().min(1).max(200),
  attributes: variantAttributesSchema.default({}),
  costPrice: moneySchema.optional(),
  defaultPrice: moneySchema,
  weightGrams: z.number().int().min(0).optional(),
  images: z.array(productImageSchema).max(20).default([]),
});

const createProductObjectSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  barcode: barcodeField,
  name: z.string().trim().min(2).max(250),
  slug: slugSchema,
  shortDescription: z.string().trim().max(500).optional(),
  description: z.string().trim().max(20000).optional(),
  brand: z.string().trim().max(120).optional(),
  status: productStatusSchema.default('DRAFT'),
  taxClass: z.enum(['STANDARD', 'REDUCED', 'ZERO']).default('STANDARD'),
  weightGrams: z.number().int().min(0).optional(),
  images: z.array(productImageSchema).max(20).default([]),
  tags: z.array(z.string().trim().max(50)).max(30).default([]),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(200).optional(),
  categoryIds: z.array(uuidSchema).max(20).default([]),
  variants: z.array(createVariantSchema).max(100).default([]),
  /**
   * Optional sale/discount price in pence. When `branchIds` are provided on create,
   * applied to each BranchProduct. Must be strictly less than variant defaultPrice.
   */
  salePrice: moneySchema.nullable().optional(),
  /**
   * Branches to attach on create. For each id, upserts BranchProduct (+ inventory)
   * for every variant using variant.defaultPrice as sellingPrice and optional salePrice.
   */
  branchIds: z.array(uuidSchema).max(50).default([]),
  /**
   * Opening stock applied to each selected branch inventory row on create.
   * Lets manually created products sell at POS without a separate stock adjustment.
   */
  initialStock: z.number().int().min(0).max(1_000_000).optional(),
});

export const createProductSchema = createProductObjectSchema.superRefine((data, ctx) => {
  if (data.salePrice == null) return;
  const originals = data.variants.map((v) => v.defaultPrice);
  if (originals.length === 0) return;
  const minOriginal = Math.min(...originals);
  if (data.salePrice >= minOriginal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Sale price must be lower than original/default price',
      path: ['salePrice'],
    });
  }
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductObjectSchema
  .partial()
  .omit({ variants: true, branchIds: true, salePrice: true, initialStock: true });
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const upsertBranchProductSchema = z
  .object({
    branchId: uuidSchema,
    productId: uuidSchema,
    variantId: uuidSchema.nullable().optional(),
    sellingPrice: moneySchema,
    salePrice: moneySchema.nullable().optional(),
    isVisible: z.boolean().default(true),
    isAvailable: z.boolean().default(true),
    deliveryEnabled: z.boolean().default(true),
    clickCollectEnabled: z.boolean().default(true),
    minimumOrderQuantity: z.number().int().min(1).max(1000).default(1),
    maximumOrderQuantity: z.number().int().min(1).max(10000).nullable().optional(),
  })
  .refine((v) => v.salePrice == null || v.salePrice < v.sellingPrice, {
    message: 'Sale price must be lower than selling price',
    path: ['salePrice'],
  });
export type UpsertBranchProductInput = z.infer<typeof upsertBranchProductSchema>;

/** Image may be an https URL or a data URL from local admin upload. */
const catalogueImageSchema = z
  .string()
  .min(1)
  .max(2_500_000)
  .refine((v) => v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:image/'), {
    message: 'Image must be a URL or image data URL',
  });

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  description: z.string().trim().max(2000).optional(),
  parentId: uuidSchema.nullable().optional(),
  image: catalogueImageSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
  allBranches: z.boolean().default(true),
  branchIds: z.array(uuidSchema).max(500).default([]),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  description: z.string().trim().max(2000).optional(),
  image: catalogueImageSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
  allBranches: z.boolean().default(true),
  branchIds: z.array(uuidSchema).max(500).default([]),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = createBrandSchema.partial();
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
