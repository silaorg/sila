import { expect, test } from '@playwright/test';

test.describe('app', () => {
  test('renders app', async ({ page }) => {
    await page.goto('/app');

    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('space-root')).toBeVisible({ timeout: 1000 });

    // Has to be ttabs present
    expect(page.locator('.ttabs-root')).toBeVisible();

    // With a message form (for chat app)
    expect(page.locator('[data-component="send-message-form"]')).toBeVisible();

    await page.screenshot({ path: 'screenshots/app.png' });
  });
});


