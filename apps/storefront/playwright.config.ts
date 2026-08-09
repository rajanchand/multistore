import { defineConfig, devices } from '@playwright/test';

/**
 * Optional smoke E2E — not run in CI by default.
 *
 * Prerequisites: API + storefront running (`pnpm dev`), DB seeded.
 *   pnpm --filter @repo/storefront exec playwright install chromium
 *   pnpm --filter @repo/storefront test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
