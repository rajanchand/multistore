import { z } from 'zod';
import { ALL_PERMISSIONS } from '@repo/types';
import { emailSchema, passwordSchema } from './auth';
import { uuidSchema } from './common';

const permissionSchema = z.string().refine((p) => (ALL_PERMISSIONS as string[]).includes(p), {
  message: 'Unknown permission',
});

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  roleIds: z.array(uuidSchema).min(1).max(10),
  // Empty array + isGlobal=false means no branch access; isGlobal=true = HQ scope.
  isGlobal: z.boolean().default(false),
  branchIds: z.array(uuidSchema).max(500).default([]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(uuidSchema).min(1).max(10).optional(),
  isGlobal: z.boolean().optional(),
  branchIds: z.array(uuidSchema).max(500).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

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

export const bulkOperationSchema = z.object({
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
  // Action-specific payload, validated per-action server-side.
  payload: z.record(z.string(), z.unknown()).default({}),
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
