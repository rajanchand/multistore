import { z } from 'zod';

/**
 * Environment validation. Each app validates the variables it needs at startup
 * and fails fast with a clear message when critical variables are missing.
 */

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL URL' }),
  REDIS_URL: z.string().url({ message: 'REDIS_URL must be a valid Redis URL' }),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_URL: z.string().url().default('http://localhost:3001'),
  API_URL: z.string().url().default('http://localhost:4000'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/** Validate and return server environment. Throws a readable error listing every problem. */
export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (cached) return cached;
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Environment validation failed. Fix the following variables (see .env.example):\n${problems}`,
    );
  }
  const data = result.data;
  // Production: if Stripe secret is configured, webhook verification must be too.
  if (data.NODE_ENV === 'production' && data.STRIPE_SECRET_KEY?.trim()) {
    if (!data.STRIPE_WEBHOOK_SECRET?.trim()) {
      throw new Error(
        'Environment validation failed. Fix the following variables (see .env.example):\n' +
          '  - STRIPE_WEBHOOK_SECRET: required in production when STRIPE_SECRET_KEY is set',
      );
    }
  }
  cached = data;
  return cached;
}

/** Reset cache (used by tests). */
export function resetEnvCache(): void {
  cached = null;
}
