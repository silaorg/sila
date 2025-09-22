import { test, expect } from '@playwright/test';

test('gallery home loads', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/Sila|Gallery/i);
});

test('chat sandbox loads within 1s and shows sidebar', async ({ page }) => {
	await page.goto('/components/chat-sandbox');
	await page.waitForLoadState('domcontentloaded');
	await expect(page.locator('body')).toBeVisible();
	// After a short while, demo space should be present; give it up to 1s total
	await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 1000 });
});

test('dual-state page renders two panes', async ({ page }) => {
	await page.goto('/components/dual-state');
	const panes = page.locator('.border.rounded');
	await expect(panes).toHaveCount(2);
});

