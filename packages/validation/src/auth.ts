import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(320);

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .refine((v) => /[a-z]/.test(v) && /[A-Z0-9]/.test(v), {
    message: 'Password must mix lower case with upper case or digits',
  });

/** Admin/staff login — email or username. */
export const loginSchema = z.object({
  /** Email address or username. */
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(128),
  mfaCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Storefront customer login — email only (normalised to lowercase). */
export const customerLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9._-]+$/, 'Username may only contain a-z, 0-9, ., _, -'),
  email: emailSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const mfaVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Must be a 6-digit code'),
});
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
