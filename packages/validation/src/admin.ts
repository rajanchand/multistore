import { z } from 'zod';
import { ALL_PERMISSIONS } from '@repo/types';
import { emailSchema, passwordSchema } from './auth';
import { uuidSchema } from './common';

const permissionSchema = z.string().refine((p) => (ALL_PERMISSIONS as string[]).includes(p), {
  message: 'Unknown permission',
});

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9._-]+$/, 'Username may only contain a-z, 0-9, ., _, -');

export const createUserSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    roleIds: z.array(uuidSchema).min(1).max(10),
    // Empty array + isGlobal=false means no branch access; isGlobal=true = HQ scope.
    isGlobal: z.boolean().default(false),
    branchIds: z.array(uuidSchema).max(500).default([]),
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (!v.isGlobal && v.branchIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one branch, or enable HQ (all branches) access',
        path: ['branchIds'],
      });
    }
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
    isActive: z.boolean().optional(),
    roleIds: z.array(uuidSchema).min(1).max(10).optional(),
    isGlobal: z.boolean().optional(),
    branchIds: z.array(uuidSchema).max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.isGlobal === false && v.branchIds && v.branchIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one branch, or enable HQ (all branches) access',
        path: ['branchIds'],
      });
    }
  });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetUserPasswordSchema = z.object({
  password: passwordSchema,
});
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Use UPPER_SNAKE_CASE'),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(permissionSchema).min(1),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = createRoleSchema.partial().omit({ name: true });
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const bulkOperationSchema = z
  .object({
    action: z.enum([
      'ADD_PRODUCT',
      'PUBLISH',
      'HIDE',
      'ARCHIVE',
      'CHANGE_PRICE',
      'SET_SALE_PRICE',
      'PERCENTAGE_ADJUSTMENT',
      'APPLY_PROMOTION',
      'REMOVE_PROMOTION',
      'CHANGE_CATEGORY',
      'CHANGE_AVAILABILITY',
    ]),
    branchIds: z.array(uuidSchema).min(1).max(500),
    productIds: z.array(uuidSchema).max(10000).default([]),
    categoryIds: z.array(uuidSchema).max(100).default([]),
    payload: z
      .object({
        confirm: z.boolean().optional(),
        sellingPrice: z.number().int().min(0).max(100_000_000).optional(),
        salePrice: z.number().int().min(0).max(100_000_000).nullable().optional(),
        percentBps: z.number().int().min(-9000).max(9000).optional(),
        isAvailable: z.boolean().optional(),
        categoryId: uuidSchema.optional(),
        promotionId: uuidSchema.optional(),
      })
      .passthrough()
      .default({}),
  })
  .superRefine((v, ctx) => {
    if (v.productIds.length === 0 && v.categoryIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one product or category',
        path: ['productIds'],
      });
    }
    if (v.action === 'CHANGE_PRICE' && typeof v.payload.sellingPrice !== 'number') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sellingPrice (pence) is required',
        path: ['payload', 'sellingPrice'],
      });
    }
    if (v.action === 'SET_SALE_PRICE' && v.payload.salePrice === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'salePrice (pence) is required — use null to clear',
        path: ['payload', 'salePrice'],
      });
    }
    if (v.action === 'PERCENTAGE_ADJUSTMENT' && typeof v.payload.percentBps !== 'number') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'percentBps is required (e.g. 500 = +5%)',
        path: ['payload', 'percentBps'],
      });
    }
    if (v.action === 'CHANGE_AVAILABILITY' && typeof v.payload.isAvailable !== 'boolean') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'isAvailable is required',
        path: ['payload', 'isAvailable'],
      });
    }
    if (v.action === 'CHANGE_CATEGORY' && !v.payload.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'categoryId is required',
        path: ['payload', 'categoryId'],
      });
    }
    if (
      (v.action === 'APPLY_PROMOTION' || v.action === 'REMOVE_PROMOTION') &&
      !v.payload.promotionId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'promotionId is required',
        path: ['payload', 'promotionId'],
      });
    }
  });
export type BulkOperationInput = z.infer<typeof bulkOperationSchema>;

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  userId: uuidSchema.optional(),
  branchId: uuidSchema.optional(),
  action: z.string().max(100).optional(),
  resourceType: z.string().max(50).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AuditQueryInput = z.infer<typeof auditQuerySchema>;
