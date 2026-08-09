import { test, expect } from '@playwright/test';

/**
 * Critical path smoke: location → browse → cart.
 * CI-optional — requires local `pnpm dev` (storefront :3000, API :4000) + seed data.
 */
test.describe('storefront smoke', () => {
  test('location gate → products → cart', async ({ page }) => {
    await page.goto('/select-location');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

    const branchButton = page.getByRole('button', { name: /glasgow|edinburgh|london|manchester|paisley/i }).first();
    await expect(branchButton).toBeVisible({ timeout: 15_000 });
    await branchButton.click();

    const continueBtn = page.getByRole('button', { name: /continue shopping/i });
    await expect(continueBtn).toBeVisible({ timeout: 10_000 });
    await continueBtn.click();

    await page.goto('/products');
    await expect(page).toHaveURL(/products/);
    await expect(page.locator('main, body')).toBeVisible();

    await page.goto('/cart');
    await expect(page).toHaveURL(/cart/);
    await expect(page.getByRole('heading', { name: /cart/i })).toBeVisible();
  });
});
