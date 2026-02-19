import { expect, test } from '@playwright/test';

test.describe('chat', () => {
  test('renders chat app', async ({ page }) => {
    await page.goto('/components/chat');

    await page.waitForLoadState('networkidle');

    // Chat app should be visible
    expect(page.locator('[data-component="chat-app"]')).toBeVisible({ timeout: 1000 });

    await page.screenshot({ path: 'screenshots/chat.png' });
  });

  test('sends a message and receives a mock response', async ({ page }) => {
    await page.goto('/components/chat/error');

    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-component="chat-app"]')).toBeVisible({ timeout: 1000 });

    const editor = page.locator('.chat-editor-host .ProseMirror');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type('Hello from test');

    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByText('Mock response: Hello from test')).toBeVisible({ timeout: 5000 });
  });
});

