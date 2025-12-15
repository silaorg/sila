import { expect, test } from '@playwright/test';

test.describe('chat', () => {
  test('renders chat app', async ({ page }) => {
    await page.goto('/components/chat');

    await page.waitForLoadState('networkidle');

    // Chat app should be visible
    expect(page.locator('[data-component="chat-app"]')).toBeVisible({ timeout: 1000 });

    await page.screenshot({ path: 'screenshots/chat.png' });
  });
});


