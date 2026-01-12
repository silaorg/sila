import { expect, test } from '@playwright/test';

test.describe('app', () => {
  test('opens Pumpkin Latte Sales thread with sidebar', async ({ page }) => {
    await page.goto('/app/pumpkin-latte');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('space-root')).toBeVisible({ timeout: 5000 });

    const spaceRoot = page.getByTestId('space-root');
    const sidebar = spaceRoot.getByTestId('sidebar');
    await expect(sidebar).toBeVisible();

    await expect(page.getByText('Pumpkin Latte Kick-off', { exact: false })).toBeVisible({
      timeout: 5000,
    });

    await page.screenshot({ path: 'screenshots/app-pumpkin-latte-sales.png' });
  });
});
