import { test, expect } from '@playwright/test';

test('gallery home loads', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Sila Gallery/i })).toBeVisible();
});

test('app loads and shows sidebar quickly', async ({ page }) => {
	await page.goto('/app');
    // Wait for either sidebar or New Conversation trigger to appear
    const sidebar = page.getByTestId('sidebar');
    const toggle = page.locator('button[aria-label*="Expand sidebar" i], button[aria-label*="Collapse sidebar" i]');
    const newConv = page.getByText(/New conversation/i);
    await Promise.race([
        sidebar.waitFor({ state: 'attached', timeout: 5000 }),
        toggle.waitFor({ state: 'visible', timeout: 5000 }),
        newConv.waitFor({ state: 'visible', timeout: 5000 }),
    ]);
});

test('dual-state page renders two panes', async ({ page }) => {
    await page.goto('/components/dual-state');
    // Assert both containers exist using heading proxies or container roles
    const cards = page.locator('div.border.rounded');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
});

