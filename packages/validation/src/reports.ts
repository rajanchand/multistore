import { z } from 'zod';
import { uuidSchema } from './common';

export const reportKindSchema = z.enum(['summary', 'sales', 'orders', 'inventory']);
export type ReportKind = z.infer<typeof reportKindSchema>;

export const reportRangeKeySchema = z
  .enum(['today', 'yesterday', '7d', '30d', 'month', 'year', 'custom'])
  .default('30d');

export const sendReportSchema = z
  .object({
    range: reportRangeKeySchema.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    branchIds: z.array(uuidSchema).max(50).optional(),
    userIds: z.array(uuidSchema).max(20).default([]),
    emails: z
      .array(z.string().trim().email().max(320))
      .max(20)
      .default([]),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.userIds.length > 0 || v.emails.length > 0, {
    message: 'Provide at least one staff user or email address',
    path: ['emails'],
  })
  .refine((v) => v.userIds.length + v.emails.length <= 20, {
    message: 'At most 20 recipients allowed',
    path: ['emails'],
  });
export type SendReportInput = z.infer<typeof sendReportSchema>;
