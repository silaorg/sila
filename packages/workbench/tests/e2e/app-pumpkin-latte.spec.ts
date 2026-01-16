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

  test('finds the last CityBean demo message with page search', async ({ page }) => {
    await page.goto('/app/pumpkin-latte');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('space-root')).toBeVisible({ timeout: 5000 });

    const findShortcut = process.platform === 'darwin' ? 'Meta+F' : 'Control+F';
    await page.keyboard.press(findShortcut);
    const searchInput = page.getByTestId('chat-page-search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('cap discounting during peak hours');

    const matches = page.locator('mark[data-chat-find]');
    await expect(matches).toHaveCount(1);
    await expect(page.getByTestId('chat-page-search-count')).toContainText('1/1');
  });
});
